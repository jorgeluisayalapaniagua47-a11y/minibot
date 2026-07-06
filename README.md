# MiniBot (CinemaBot)

Este proyecto implementa el ejercicio de la pasantía para un bot conversacional, conectando una API (Node.js/Express) con una base de datos (SQLite), un Webhook idempotente y un CRM básico.

## 1. Instalación
Abre la terminal en la carpeta `minibot` y ejecuta:
```bash
npm install
```
*(Nota: El proyecto usa `sqlite3` de forma síncrona/promesas como base de datos, ya que en Windows puede haber conflictos compilando `better-sqlite3`).*

## 2. Ejecución
Para arrancar el servidor local en el puerto 3000, ejecuta:
```bash
npm run dev
# o también: node index.js
```

## 3. Configuración del Webhook
El webhook `/webhook/confirmacion` espera recibir un header de autorización llamado `x-webhook-secret`. 
Por defecto, el código valida que el secreto sea `abc123` (simulando una variable de entorno `WEBHOOK_SECRET=abc123`).

## 4. Correr la Demo (Las 5 Pruebas)
Para evaluar las 5 pruebas requeridas por la pasantía, asegúrate de tener el servidor corriendo y en otra terminal (preferiblemente Git Bash) ejecuta el script de demostración:
```bash
bash demo.sh
```
*(Asegúrate de partir de una base limpia eliminando `minibot.db` antes de arrancar si quieres empezar de cero).*
