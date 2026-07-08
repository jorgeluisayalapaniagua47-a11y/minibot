#!/bin/bash

BASE_URL="http://localhost:3000"
FROM="5917046"

echo "========================================="
echo "INICIANDO PRUEBAS DE MINIBOT (bot pelicula)"
echo "========================================="
echo ""

echo "Prueba 1: Iniciar bot y obtener géneros (Paso 0)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Hola, quiero ver una película.\"}"
echo -e "\n"

echo "Prueba 2: Robustez con opción inválida en selección de género"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Quiero ver algo de terror\"}"
echo -e "\n"

echo "Prueba 3: Seleccionar género Acción (Paso 1) -> Muestra Películas"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 4: Retroceder en selección de películas -> Regresa a géneros"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"3\"}"
echo -e "\n"

echo "Prueba 5: Re-seleccionar género Acción"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 6: Seleccionar película Mad Max -> Muestra sinopsis, póster y horarios con 50 boletos"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 7: Retroceder en selección de horarios -> Regresa a películas"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"4\"}"
echo -e "\n"

echo "Prueba 8: Re-seleccionar película Mad Max"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 9: Seleccionar horario de las 20:00 (Paso 2) -> Pregunta cantidad de boletos"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"2\"}"
echo -e "\n"

echo "Prueba 10: Retroceder en selección de boletos -> Regresa a horarios"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"volver\"}"
echo -e "\n"

echo "Prueba 11: Re-seleccionar horario de las 20:00"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"2\"}"
echo -e "\n"

echo "Prueba 12: Robustez con cantidad inválida de boletos (99 boletos)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"99\"}"
echo -e "\n"

echo "Prueba 13: Seleccionar cantidad válida (4 boletos) -> Reserva Pendiente y bloqueada"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"4\"}"
echo -e "\n"

echo "Prueba 14: Verificar bloqueo transaccional"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Hola, ¿está lista mi reserva?\"}"
echo -e "\n"

echo "Prueba 15: Consultar CRM API (Debe mostrar la reserva REQ-1 como Pendiente)"
echo "-----------------------------------------"
curl -s -X GET $BASE_URL/api/solicitudes
echo -e "\n"

echo "Prueba 16: Simular pago mediante Webhook con Secreto Correcto"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/webhook/confirmacion \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: abc123' \
  -d '{"evento_id":"ev-101","solicitud_id":1}'
echo -e "\n"

echo "Prueba 17: Validar idempotencia del Webhook (Llamada duplicada)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/webhook/confirmacion \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: abc123' \
  -d '{"evento_id":"ev-101","solicitud_id":1}'
echo -e "\n"

echo "Prueba 18: Mensaje de confirmación del usuario -> Desbloquea y muestra mensaje de éxito"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Hola\"}"
echo -e "\n"

echo "Prueba 19: Avanzar flujo para validar decremento de boletos (Generos -> Peliculas)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 20: Consultar Mad Max -> Verificar que a las 20:00 quedan 46 boletos"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"

echo "Prueba 21: Consultar CRM API nuevamente (Debe mostrar estado Confirmado)"
echo "-----------------------------------------"
curl -s -X GET $BASE_URL/api/solicitudes
echo -e "\n"

echo "========================================="
echo "PRUEBAS FINALIZADAS"
echo "========================================="
