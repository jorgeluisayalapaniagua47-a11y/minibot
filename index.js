const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(express.json());
app.use('/img', express.static(path.join(__dirname, 'img')));

// Configuración DB
const db = new sqlite3.Database('minibot.db');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS contactos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefono TEXT UNIQUE,
        nombre TEXT,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS mensajes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER,
        direccion TEXT,
        texto TEXT,
        imagen_url TEXT,
        paso INTEGER,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS solicitudes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contacto_id INTEGER,
        producto TEXT,
        estado TEXT,
        evento_id TEXT UNIQUE,
        creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Helpers DB
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

// Memoria para sesiones temporales (como sugiere la guía)
const sesiones = {};

// 1. Endpoint Bot
app.post('/messages', async (req, res) => {
    const { from, text } = req.body;
    if (!from) return res.status(400).json({ error: 'falta from' });

    // Upsert contacto
    let contacto = await dbGet('SELECT * FROM contactos WHERE telefono = ?', [from]);
    if (!contacto) {
        await dbRun('INSERT INTO contactos (telefono) VALUES (?)', [from]);
        contacto = await dbGet('SELECT * FROM contactos WHERE telefono = ?', [from]);
    }

    const s = sesiones[from] ?? { paso: 0 };
    
    // Revisar si está bloqueado por una solicitud pendiente
    const pendingReq = await dbGet('SELECT * FROM solicitudes WHERE contacto_id = ? AND estado = ?', [contacto.id, 'Pendiente']);

    let reply = "";
    let image = null;
    let nextPaso = s.paso;

    if (pendingReq) {
        // Bloqueo Paso 2
        reply = `Tu solicitud ${pendingReq.producto} sigue pendiente de pago o confirmación externa. Por favor, procesa el Webhook de simulación para continuar.`;
        nextPaso = 2; // Mantiene el paso
    } else {
        // Máquina de estados
        switch (s.paso) {
            case 0:
                reply = `¡Hola! Bienvenido a CinemaBot 🍿. Elige el número del género que te apetece ver hoy:\n1. Acción 💥\n2. Ciencia Ficción 👽\n3. Drama/Suspenso 🎭`;
                nextPaso = 1;
                break;
            case 1:
                if (text === "1") {
                    reply = `¡Excelente elección! Tu recomendación es:\nMad Max: Fury Road\n\nSinopsis: En un futuro post-apocalíptico, una mujer se rebela contra un líder tiránico en busca de su hogar con la ayuda de un grupo de prisioneras y un vagabundo llamado Max.\nPóster oficial: imagen\nGeneramos tu Solicitud de Entrada: REQ-101 (Estado: PENDIENTE).\nPara confirmar tu ticket, simula la confirmación externa enviando el ID de solicitud al webhook.`;
                    image = '/img/madmax.jpg';
                    
                    // Crear solicitud pendiente
                    await dbRun('INSERT INTO solicitudes (contacto_id, producto, estado) VALUES (?, ?, ?)', [contacto.id, 'REQ-101', 'Pendiente']);
                    
                    nextPaso = 2; 
                } else if (text === "2") {
                    reply = `¡Excelente elección! Tu recomendación es:\nInterstellar\n\nSinopsis: Un grupo de exploradores hace uso de un agujero de gusano recientemente descubierto para superar las limitaciones de los viajes espaciales humanos y vencer las inmensas distancias de un viaje interestelar.\nPóster oficial: imagen\nGeneramos tu Solicitud de Entrada: REQ-102 (Estado: PENDIENTE).\nPara confirmar tu ticket, simula la confirmación externa enviando el ID de solicitud al webhook.`;
                    image = '/img/interstellar.jpg';
                    
                    // Crear solicitud pendiente
                    await dbRun('INSERT INTO solicitudes (contacto_id, producto, estado) VALUES (?, ?, ?)', [contacto.id, 'REQ-102', 'Pendiente']);
                    
                    nextPaso = 2; 
                } else if (text === "3") {
                    reply = `¡Excelente elección! Tu recomendación es:\nShutter Island (La isla siniestra)\n\nSinopsis: En 1954, el alguacil Teddy Daniels es asignado para investigar la desaparición de una paciente de un hospital psiquiátrico en una isla remota.\nPóster oficial: imagen\nGeneramos tu Solicitud de Entrada: REQ-103 (Estado: PENDIENTE).\nPara confirmar tu ticket, simula la confirmación externa enviando el ID de solicitud al webhook.`;
                    image = '/img/shutterisland.jpg';
                    
                    // Crear solicitud pendiente
                    await dbRun('INSERT INTO solicitudes (contacto_id, producto, estado) VALUES (?, ?, ?)', [contacto.id, 'REQ-103', 'Pendiente']);
                    
                    nextPaso = 2; 
                } else {
                    reply = `Opción no válida. Por favor, selecciona 1, 2 o 3 para poder recomendarte una película de nuestro catálogo.`;
                }
                break;
            case 2:
                // Si estaba en paso 2 pero pendingReq es falso (fue confirmada por webhook)
                // Reiniciamos al paso 0 y respondemos como paso 0
                reply = `¡Hola! Bienvenido a CinemaBot 🍿. Elige el número del género que te apetece ver hoy:\n1. Acción 💥\n2. Ciencia Ficción 👽\n3. Drama/Suspenso 🎭`;
                nextPaso = 1;
                break;
            default:
                reply = `¡Hola! Bienvenido a CinemaBot 🍿. Elige el número del género que te apetece ver hoy:\n1. Acción 💥\n2. Ciencia Ficción 👽\n3. Drama/Suspenso 🎭`;
                nextPaso = 1;
                break;
        }
    }

    // Actualizar estado memoria
    sesiones[from] = { paso: nextPaso };

    // Persistir mensajes
    await dbRun('INSERT INTO mensajes (contacto_id, direccion, texto, imagen_url, paso) VALUES (?, ?, ?, ?, ?)', [contacto.id, 'in', text, null, s.paso]);
    await dbRun('INSERT INTO mensajes (contacto_id, direccion, texto, imagen_url, paso) VALUES (?, ?, ?, ?, ?)', [contacto.id, 'out', reply, image, nextPaso]);

    const responseBody = { reply };
    if (image) responseBody.image = image;

    res.json(responseBody);
});

// 2. Webhook Endpoint
app.post('/webhook/confirmacion', async (req, res) => {
    // Validar secreto
    const secret = process.env.WEBHOOK_SECRET || 'abc123';
    if (req.headers['x-webhook-secret'] !== secret) {
        return res.status(401).json({ error: 'no autorizado' });
    }

    const { evento_id, solicitud_id } = req.body;
    
    // Bonus: datos incompletos -> 400
    if (!evento_id || !solicitud_id) {
        return res.status(400).json({ error: 'datos incompletos' });
    }

    try {
        // Idempotencia: Verificar si existe el evento_id
        const existing = await dbGet('SELECT * FROM solicitudes WHERE evento_id = ?', [evento_id]);
        if (existing) {
            return res.json({ ok: true, duplicado: true });
        }

        // Actualizar estado a confirmada
        const result = await dbRun('UPDATE solicitudes SET estado = ?, evento_id = ? WHERE id = ?', ['Confirmado', evento_id, solicitud_id]);
        
        if (result.changes === 0) {
             return res.status(404).json({ error: 'solicitud no encontrada' });
        }

        res.json({ ok: true, duplicado: false });
    } catch(err) {
        // Si hay un error de UNIQUE constraint (otra llamada concurrente lo insertó)
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.json({ ok: true, duplicado: true });
        }
        res.status(500).json({ error: 'error interno' });
    }
});

// 3. CRM Endpoints
app.get('/api/solicitudes', async (req, res) => {
    const rows = await dbAll(`
        SELECT s.*, c.telefono, c.nombre 
        FROM solicitudes s 
        JOIN contactos c ON s.contacto_id = c.id
        ORDER BY s.id DESC
    `);
    res.json(rows);
});

app.get('/crm', (req, res) => {
    res.sendFile(path.join(__dirname, 'crm.html'));
});

app.listen(3000, () => console.log('MiniBot en http://localhost:3000'));
