#!/bin/bash

BASE_URL="http://localhost:3000"
FROM="591700"

echo "========================================="
echo "INICIANDO PRUEBAS DE MINIBOT (bot pelicula)"
echo "========================================="
echo ""

echo "Prueba 1: Flujo completo (Paso 0)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Hola, quiero ver una película.\"}"
echo -e "\n"

echo "Prueba 1: Input inesperado (Robustez en Paso 1)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Quiero ver algo de terror\"}"
echo -e "\n"

echo "Prueba 1 y 2: Selección correcta (Paso 1) y Entrega de Imagen"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"1\"}"
echo -e "\n"
echo "Para verificar la Prueba 2 (Imagen), abre en tu navegador: $BASE_URL/img/madmax.jpg"
echo ""

echo "Prueba 2.5: Bloqueo esperando Webhook (Paso 2)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"¿Ya está mi entrada?\"}"
echo -e "\n"

echo "Prueba 3: Persistencia (Consultar CRM API)"
echo "-----------------------------------------"
curl -s -X GET $BASE_URL/api/solicitudes
echo -e "\n"

echo "Prueba 4a: Webhook SIN SECRETO (Debe fallar con 401)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/webhook/confirmacion \
  -H 'Content-Type: application/json' \
  -d '{"evento_id":"ev-101","solicitud_id":1}'
echo -e "\n"

echo "Prueba 4b: Webhook CON SECRETO (Debe ser 200 OK y actualizar estado)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/webhook/confirmacion \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: abc123' \
  -d '{"evento_id":"ev-101","solicitud_id":1}'
echo -e "\n"

echo "Prueba 4c: Webhook DUPLICADO (Idempotencia - Debe ser 200 OK y decir duplicado: true)"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/webhook/confirmacion \
  -H 'Content-Type: application/json' \
  -H 'x-webhook-secret: abc123' \
  -d '{"evento_id":"ev-101","solicitud_id":1}'
echo -e "\n"

echo "Prueba 5: CRM Refleja el Cambio"
echo "-----------------------------------------"
echo "Para la Prueba 5, abre $BASE_URL/crm en tu navegador y verifica que el estado diga CONFIRMADA."
echo ""

echo "Prueba Post-Webhook: Destrabe del flujo"
echo "-----------------------------------------"
curl -s -X POST $BASE_URL/messages \
  -H 'Content-Type: application/json' \
  -d "{\"from\":\"$FROM\",\"text\":\"Hola\"}"
echo -e "\n"

echo "========================================="
echo "PRUEBAS FINALIZADAS"
echo "========================================="
