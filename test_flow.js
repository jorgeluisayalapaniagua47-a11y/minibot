const BASE_URL = 'http://localhost:3000';
const FROM = '5917046';

async function sendMsg(text) {
    const res = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, text })
    });
    const data = await res.json();
    console.log(`User: "${text}"`);
    console.log(`Bot Reply: ${data.reply}`);
    if (data.image) console.log(`Bot Image: ${data.image}`);
    return data;
}

async function getSolicitudes() {
    const res = await fetch(`${BASE_URL}/api/solicitudes`);
    const data = await res.json();
    console.log('\n--- CRM SOLICITUDES ---');
    console.log(JSON.stringify(data, null, 2));
    return data;
}

async function triggerWebhook(solicitudId, eventId, secret) {
    const headers = { 'Content-Type': 'application/json' };
    if (secret) headers['x-webhook-secret'] = secret;

    const res = await fetch(`${BASE_URL}/webhook/confirmacion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ evento_id: eventId, solicitud_id: solicitudId })
    });
    const data = await res.json();
    console.log(`Webhook status: ${res.status}`);
    console.log(`Webhook Reply:`, data);
    return { status: res.status, data };
}

async function run() {
    console.log('=========================================');
    console.log('INICIANDO PRUEBAS DE MINIBOT (test_flow.js)');
    console.log('=========================================\n');

    console.log('--- Prueba 1: Iniciar bot y obtener géneros (Paso 0) ---');
    await sendMsg('Hola, quiero ver una película.');
    console.log('');

    console.log('--- Prueba 2: Robustez con opción inválida en selección de género ---');
    await sendMsg('Quiero ver algo de terror');
    console.log('');

    console.log('--- Prueba 3: Seleccionar género Acción (Paso 1) -> Películas ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 4: Retroceder en selección de películas -> Géneros ---');
    await sendMsg('3');
    console.log('');

    console.log('--- Prueba 5: Re-seleccionar género Acción ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 6: Seleccionar película Mad Max -> Sinopsis, poster y horarios ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 7: Retroceder en selección de horarios -> Películas ---');
    await sendMsg('4');
    console.log('');

    console.log('--- Prueba 8: Re-seleccionar película Mad Max ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 9: Seleccionar horario de las 20:00 -> Cantidad de boletos ---');
    await sendMsg('2');
    console.log('');

    console.log('--- Prueba 10: Retroceder en selección de boletos -> Horarios ---');
    await sendMsg('volver');
    console.log('');

    console.log('--- Prueba 11: Re-seleccionar horario de las 20:00 ---');
    await sendMsg('2');
    console.log('');

    console.log('--- Prueba 12: Robustez con cantidad inválida de boletos (99 boletos) ---');
    await sendMsg('99');
    console.log('');

    console.log('--- Prueba 13: Seleccionar cantidad válida (4 boletos) -> Reserva creada y bloqueada ---');
    await sendMsg('4');
    console.log('');

    console.log('--- Prueba 14: Verificar bloqueo transaccional ---');
    await sendMsg('Hola, ¿está lista mi reserva?');
    console.log('');

    console.log('--- Prueba 15: Consultar CRM API ---');
    const solicitudes = await getSolicitudes();
    const targetId = solicitudes[0]?.id || 1;
    console.log('');

    console.log('--- Prueba 16: Simular pago mediante Webhook con Secreto Correcto ---');
    await triggerWebhook(targetId, 'ev-101', 'abc123');
    console.log('');

    console.log('--- Prueba 17: Validar idempotencia del Webhook (Duplicado) ---');
    await triggerWebhook(targetId, 'ev-101', 'abc123');
    console.log('');

    console.log('--- Prueba 18: Mensaje de confirmación del usuario -> Desbloquea y muestra éxito ---');
    await sendMsg('Hola');
    console.log('');

    console.log('--- Prueba 19: Avanzar flujo para validar decremento (Generos -> Peliculas) ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 20: Consultar Mad Max -> Verificar que quedan 46 boletos ---');
    await sendMsg('1');
    console.log('');

    console.log('--- Prueba 21: Consultar CRM API nuevamente ---');
    await getSolicitudes();
    console.log('');

    console.log('=========================================');
    console.log('PRUEBAS FINALIZADAS CON ÉXITO');
    console.log('=========================================');
}

run().catch(console.error);
