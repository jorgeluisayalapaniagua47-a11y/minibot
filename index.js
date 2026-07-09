const express = require('express');
const path = require('path');
const supabase = require('./db');

const app = express();
app.use(express.json());
app.use('/img', express.static(path.join(__dirname, 'img')));

const PORT = process.env.PORT || 3000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const API_VERSION = process.env.API_VERSION || 'v21.0';
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// ----------------------------------------------------
// FUNCIONES DE AYUDA (SUPABASE)
// ----------------------------------------------------
async function getGenerosMenu() {
    const { data: generos, error } = await supabase.from('generos').select('*').order('id', { ascending: true });
    if (error) {
        console.error("Error cargando géneros:", error);
        return "Hubo un error cargando el menú.";
    }

    let menu = `¡Hola! Bienvenido a CinemaBot. Elige el número del género que te apetece ver hoy:\n`;
    generos.forEach(g => {
        menu += `${g.id}. ${g.nombre}\n`;
    });
    return menu;
}

// ----------------------------------------------------
// FUNCIONES DE AYUDA DE LA API DE WHATSAPP CLOUD
// ----------------------------------------------------
async function enviarMensajeWhatsApp(telefono, texto, hostname, req) {
    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        console.warn(`[Modo Simulado] Enviando texto a ${telefono}: ${texto}`);
        return;
    }
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: telefono,
                type: "text",
                text: { body: texto }
            })
        });
        const data = await res.json();
        if (data.error) console.error("Error API Meta (Mensaje):", data.error);
    } catch (e) {
        console.error("Error enviando mensaje WhatsApp:", e);
    }
}

async function enviarImagenWhatsApp(telefono, urlParcial, pieFoto, hostname, req) {
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const urlAbsoluta = `${protocol}://${hostname}${urlParcial}`;

    if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
        console.warn(`[Modo Simulado] Enviando imagen a ${telefono}: ${urlAbsoluta}`);
        return;
    }
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: telefono,
                type: "image",
                image: { link: urlAbsoluta, caption: pieFoto }
            })
        });
        const data = await res.json();
        if (data.error) console.error("Error API Meta (Imagen):", data.error);
    } catch (e) {
        console.error("Error enviando imagen WhatsApp:", e);
    }
}

// ----------------------------------------------------
// 1. VERIFICACIÓN DEL WEBHOOK DE META (GET)
// ----------------------------------------------------
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'] || req.query['hub_mode'];
    const token = req.query['hub.verify_token'] || req.query['hub_verify_token'];
    const challenge = req.query['hub.challenge'] || req.query['hub_challenge'];

    if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.status(403).send("Prohibido");
});

// ----------------------------------------------------
// 2. RECEPCIÓN DE MENSAJES (POST)
// ----------------------------------------------------
app.post('/webhook', async (req, res) => {
    const body = req.body;

    if (body.object !== 'whatsapp_business_account' || !body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
        return res.status(200).send("EVENT_RECEIVED");
    }

    const messageObj = body.entry[0].changes[0].value.messages[0];
    const wa_id = messageObj.from;
    const text = messageObj.text?.body?.trim();
    const wa_message_id = messageObj.id;
    const entryId = body.entry[0].id;

    if (messageObj.from_user_id === entryId || !text) {
        return res.status(200).send("EVENT_RECEIVED");
    }

    try {
        // Upsert contacto
        let { data: contacto, error: contactoErr } = await supabase.from('contactos').select('*').eq('wa_id', wa_id).single();

        if (contactoErr && contactoErr.code === 'PGRST116') {
            // No existe, crear
            const { data: newContacto, error: insErr } = await supabase.from('contactos')
                .insert([{ wa_id, nombre_perfil: messageObj.profile?.name || '' }])
                .select().single();
            if (insErr) throw insErr;
            contacto = newContacto;
        } else if (contactoErr) {
            throw contactoErr;
        }

        // Control Idempotencia
        const { error: msgErr } = await supabase.from('mensajes').insert([{
            contacto_id: contacto.id,
            direccion: 'in',
            wa_message_id: wa_message_id,
            tipo_mensaje: 'text',
            contenido: text
        }]);

        if (msgErr) {
            if (msgErr.code === '23505' || msgErr.message.includes('unique constraint')) {
                console.log(`Mensaje duplicado de Meta ignorado (Supabase): ${wa_message_id}`);
                return;
            }
            throw msgErr;
        }

        let estado = contacto.estado_conversacion || 'WELCOME';
        let ctx = contacto.contexto_json || {};
        let reply = "";
        let image = null;
        let nextEstado = estado;

        // Comprobación de reserva expirada
        if (estado === 'PENDIENTE_PAGO') {
            const { data: reserva } = await supabase.from('reservas')
                .select('*')
                .eq('contacto_id', contacto.id)
                .eq('estado', 'PENDIENTE')
                .order('id', { ascending: false })
                .limit(1)
                .single();

            if (reserva) {
                const creadoEn = new Date(reserva.creado_en + 'Z'); // Supabase devuelve timestamps UTC
                const diffMins = (new Date() - creadoEn) / 1000 / 60;

                if (diffMins > 10) {
                    await supabase.from('reservas').update({ estado: 'CANCELADA' }).eq('id', reserva.id);
                    // Devolver capacidad
                    const { data: f } = await supabase.from('funciones').select('capacidad_disponible').eq('id', reserva.funcion_id).single();
                    await supabase.from('funciones').update({ capacidad_disponible: f.capacidad_disponible + reserva.cantidad_entradas }).eq('id', reserva.funcion_id);

                    reply = `Tu tiempo de 10 minutos ha expirado. Los boletos fueron liberados.\n\nEscribe cualquier cosa para volver a empezar.`;
                    nextEstado = 'WELCOME';
                    ctx = {};
                } else {
                    const minsRestantes = Math.ceil(10 - diffMins);
                    reply = `Todavía tienes una reserva pendiente. Te quedan ${minsRestantes} minutos.\n*(Para simular el pago, POST a /webhook/confirmacion con reserva_id: ${reserva.id})*`;
                    nextEstado = 'PENDIENTE_PAGO';
                }
            } else {
                nextEstado = 'WELCOME';
            }
        }

        if (nextEstado !== 'PENDIENTE_PAGO') {
            switch (estado) {
                case 'WELCOME': {
                    reply = await getGenerosMenu();
                    nextEstado = 'WAIT_MOVIE';
                    ctx = {};
                    break;
                }
                case 'WAIT_MOVIE': {
                    if (text === "0") {
                        reply = await getGenerosMenu();
                        nextEstado = 'WAIT_MOVIE';
                        break;
                    }
                    const generoId = parseInt(text);
                    const { data: genero } = await supabase.from('generos').select('*').eq('id', generoId).single();

                    if (genero) {
                        const { data: peliculas } = await supabase.from('peliculas').select('*').eq('genero_id', genero.id).eq('activa', true);
                        if (peliculas && peliculas.length > 0) {
                            ctx.genero_id = genero.id;
                            ctx.peliculas_map = peliculas.map(p => p.id);
                            let list = peliculas.map((p, i) => `${i + 1}. ${p.titulo}`).join('\n');
                            reply = `Has elegido ${genero.nombre}. Selecciona una película:\n${list}\n0. ⬅️ Volver al menú de géneros`;
                            nextEstado = 'WAIT_SCHEDULE';
                        } else {
                            reply = `No hay películas en ${genero.nombre}.\n\n` + await getGenerosMenu();
                        }
                    } else {
                        reply = `Opción inválida.\n\n` + await getGenerosMenu();
                    }
                    break;
                }
                case 'WAIT_SCHEDULE': {
                    if (text === "0") {
                        reply = await getGenerosMenu();
                        nextEstado = 'WAIT_MOVIE';
                        ctx = {};
                        break;
                    }
                    const idx = parseInt(text) - 1;
                    if (ctx.peliculas_map && ctx.peliculas_map[idx]) {
                        const peliculaId = ctx.peliculas_map[idx];
                        ctx.pelicula_id = peliculaId;

                        const { data: p } = await supabase.from('peliculas').select('*').eq('id', peliculaId).single();
                        const { data: funciones } = await supabase.from('funciones').select('*').eq('pelicula_id', peliculaId).order('fecha_hora', { ascending: true });

                        if (funciones && funciones.length > 0) {
                            reply = (p.sinopsis || "Sin sinopsis") + `\n\nElige el horario de la función:\n`;
                            ctx.funciones_map = funciones.map(f => f.id);

                            funciones.forEach((f, i) => {
                                // Formatear fecha simple
                                const fh = new Date(f.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                                reply += `${i + 1}. ${fh} (${f.capacidad_disponible} disponibles, $${f.precio_unitario})\n`;
                            });
                            reply += `0. ⬅️ Volver a selección de películas`;
                            image = p.imagen_url;
                            nextEstado = 'WAIT_QUANTITY';
                        } else {
                            reply = `No hay funciones para esta película. Escribe 0 para volver.`;
                        }
                    } else {
                        reply = `Opción inválida. Escribe 0 para volver.`;
                    }
                    break;
                }
                case 'WAIT_QUANTITY': {
                    if (text === "0") {
                        const { data: peliculas } = await supabase.from('peliculas').select('*').eq('genero_id', ctx.genero_id).eq('activa', true);
                        ctx.peliculas_map = peliculas.map(p => p.id);
                        let list = peliculas.map((p, i) => `${i + 1}. ${p.titulo}`).join('\n');
                        reply = `Selecciona una película:\n${list}\n0. ⬅️ Volver`;
                        nextEstado = 'WAIT_SCHEDULE';
                        break;
                    }
                    const idx = parseInt(text) - 1;
                    if (ctx.funciones_map && ctx.funciones_map[idx]) {
                        const funcionId = ctx.funciones_map[idx];
                        ctx.funcion_id = funcionId;
                        const { data: funcion } = await supabase.from('funciones').select('*').eq('id', funcionId).single();

                        if (funcion.capacidad_disponible <= 0) {
                            reply = `La función está llena. Elige otra escribiendo 0.`;
                        } else {
                            const fh = new Date(funcion.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                            reply = `Has seleccionado las ${fh}.\n¿Cuántos boletos deseas comprar? (Máximo: ${funcion.capacidad_disponible}).\nEscribe 0 para volver.`;
                            nextEstado = 'PENDIENTE_RESERVA';
                        }
                    } else {
                        reply = `Opción inválida. Escribe 0 para volver.`;
                    }
                    break;
                }
                case 'PENDIENTE_RESERVA': {
                    if (text === "0") {
                        const { data: funciones } = await supabase.from('funciones').select('*').eq('pelicula_id', ctx.pelicula_id).order('fecha_hora', { ascending: true });
                        ctx.funciones_map = funciones.map(f => f.id);
                        reply = `Elige el horario:\n`;
                        funciones.forEach((f, i) => {
                            const fh = new Date(f.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                            reply += `${i + 1}. ${fh} (${f.capacidad_disponible} disponibles)\n`;
                        });
                        reply += `0. ⬅️ Volver`;
                        nextEstado = 'WAIT_QUANTITY';
                        break;
                    }
                    const cantidad = parseInt(text);
                    if (isNaN(cantidad) || cantidad <= 0) {
                        reply = `Cantidad inválida. Ingresa un número mayor a cero.`;
                    } else {
                        const { data: funcion } = await supabase.from('funciones').select('*').eq('id', ctx.funcion_id).single();
                        if (cantidad > funcion.capacidad_disponible) {
                            reply = `Solo hay ${funcion.capacidad_disponible} asientos disponibles. Intenta con una cantidad menor.`;
                        } else {
                            const total = funcion.precio_unitario * cantidad;
                            const { data: pelicula } = await supabase.from('peliculas').select('*').eq('id', funcion.pelicula_id).single();

                            // Disminuir capacidad
                            await supabase.from('funciones').update({ capacidad_disponible: funcion.capacidad_disponible - cantidad }).eq('id', funcion.id);

                            // Crear reserva
                            const { data: resIns } = await supabase.from('reservas').insert([{
                                contacto_id: contacto.id,
                                funcion_id: funcion.id,
                                cantidad_entradas: cantidad,
                                monto_total: total,
                                estado: 'PENDIENTE'
                            }]).select().single();

                            const fh = new Date(funcion.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                            reply = `¡Reserva generada con éxito!\n\n🎬 ${pelicula.titulo}\n🕒 ${fh}\n🎟️ ${cantidad} boletos\n💰 Total: $${total}\n\nTienes 10 minutos para pagar.\n*(Simula POST a /webhook/confirmacion con reserva_id: ${resIns.id})*`;
                            nextEstado = 'PENDIENTE_PAGO';
                        }
                    }
                    break;
                }
                default:
                    reply = await getGenerosMenu();
                    nextEstado = 'WAIT_MOVIE';
                    ctx = {};
                    break;
            }
        }

        // Guardar nuevo estado en Supabase
        await supabase.from('contactos').update({
            estado_conversacion: nextEstado,
            contexto_json: ctx,
            actualizado_en: new Date().toISOString()
        }).eq('id', contacto.id);

        // Enviar WhatsApp
        const hostname = req.headers.host;
        if (image) {
            await enviarImagenWhatsApp(wa_id, image, reply, hostname, req);
        } else {
            await enviarMensajeWhatsApp(wa_id, reply, hostname, req);
        }

        // Registrar mensaje de salida
        await supabase.from('mensajes').insert([{
            contacto_id: contacto.id,
            direccion: 'out',
            wa_message_id: 'local_' + Date.now(),
            tipo_mensaje: image ? 'image' : 'text',
            contenido: reply
        }]);

    } catch (err) {
        console.error("Error procesando Webhook:", err);
    } finally {
        if (!res.headersSent) {
            res.status(200).send("EVENT_RECEIVED");
        }
    }
});

// ----------------------------------------------------
// 3. WEBHOOK ENDPOINT DE PAGOS
// ----------------------------------------------------
app.post('/webhook/confirmacion', async (req, res) => {
    const { evento_id, reserva_id, metodo_pago = "TEST" } = req.body;

    if (!evento_id || !reserva_id) {
        return res.status(400).json({ error: 'Faltan evento_id o reserva_id' });
    }

    try {
        const { data: reserva } = await supabase.from('reservas').select('*').eq('id', reserva_id).single();
        if (!reserva) return res.status(404).json({ error: 'reserva no encontrada' });

        const creadoEn = new Date(reserva.creado_en + 'Z');
        const diffMins = (new Date() - creadoEn) / 1000 / 60;

        if (reserva.estado === 'CANCELADA' || diffMins > 10) {
            if (reserva.estado === 'PENDIENTE') {
                await supabase.from('reservas').update({ estado: 'CANCELADA' }).eq('id', reserva_id);
                const { data: f } = await supabase.from('funciones').select('capacidad_disponible').eq('id', reserva.funcion_id).single();
                await supabase.from('funciones').update({ capacidad_disponible: f.capacidad_disponible + reserva.cantidad_entradas }).eq('id', reserva.funcion_id);
            }
            return res.status(400).json({ error: 'la reserva ha expirado o fue cancelada' });
        }

        // Idempotencia de Pagos
        const { error: pagoErr } = await supabase.from('pagos').insert([{
            reserva_id: reserva_id,
            evento_id: evento_id,
            metodo_pago: metodo_pago,
            monto: reserva.monto_total,
            estado: 'APROBADO'
        }]);

        if (pagoErr) {
            if (pagoErr.code === '23505') return res.json({ ok: true, duplicado: true });
            throw pagoErr;
        }

        await supabase.from('reservas').update({ estado: 'CONFIRMADA' }).eq('id', reserva_id);

        const { data: contacto } = await supabase.from('contactos').select('*').eq('id', reserva.contacto_id).single();
        const { data: funcion } = await supabase.from('funciones').select('*, peliculas(titulo)').eq('id', reserva.funcion_id).single();

        if (contacto && funcion) {
            const fh = new Date(funcion.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            const voucher =
                `========================================
       🎟️ VOUCHER DE CINEMABOT 🎟️
========================================
Película: ${funcion.peliculas.titulo}
Horario:  ${fh}
Entradas: ${reserva.cantidad_entradas} boletos
Total:    $${reserva.monto_total}
Estado:   CONFIRMADO ✅
Pago ID:  ${evento_id}
========================================`;

            const mensajeExito = `¡Pago exitoso! Tu compra ha sido confirmada.\n\n${voucher}\n\nEscribe cualquier cosa para volver al menú principal.`;

            await supabase.from('contactos').update({ estado_conversacion: 'WELCOME', contexto_json: {} }).eq('id', contacto.id);

            const hostname = req.headers.host;
            await enviarMensajeWhatsApp(contacto.wa_id, mensajeExito, hostname, req);

            await supabase.from('mensajes').insert([{
                contacto_id: contacto.id,
                direccion: 'out',
                wa_message_id: 'local_voucher_' + Date.now(),
                tipo_mensaje: 'text',
                contenido: mensajeExito
            }]);
        }

        res.json({ ok: true, duplicado: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'error interno' });
    }
});

// ----------------------------------------------------
// 4. CRM DASHBOARD PANEL
// ----------------------------------------------------
app.get('/api/solicitudes', async (req, res) => {
    // Left Join a través de las foreign keys en Supabase
    const { data: reservas, error } = await supabase
        .from('reservas')
        .select(`
            *,
            contactos (wa_id, nombre_perfil),
            funciones (fecha_hora, peliculas (titulo))
        `)
        .order('id', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const mapped = reservas.map(row => {
        const fh = new Date(row.funciones.fecha_hora + 'Z').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        return {
            ...row,
            telefono: row.contactos.wa_id,
            nombre: row.contactos.nombre_perfil,
            horario: fh,
            pelicula: row.funciones.peliculas.titulo,
            cantidad: row.cantidad_entradas,
            producto: `${row.funciones.peliculas.titulo} (${fh}) x ${row.cantidad_entradas} boletos`
        };
    });
    res.json(mapped);
});

app.get('/crm', (req, res) => {
    res.sendFile(path.join(__dirname, 'crm.html'));
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`MiniBot en http://localhost:${PORT}`));
}

module.exports = app;
