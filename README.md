# Eco-Snacks — aplicación web

Proyecto de emprendimiento con frontend React, API Express, formulario de contacto, acceso de administración y asistente virtual adaptado al negocio.

## Requisitos
- Node.js 20 o superior
- npm
- Git (para el repositorio)

## Estructura
- `client/`: React + Vite; reutiliza el diseño de `style.css`.
- `server/`: API REST, base de datos SQLite, autenticación administrativa y asistente.
- `server/.env.example`: plantilla de configuración; copia a `server/.env`.

## Ejecutar en local
Abre dos terminales desde la carpeta raíz del proyecto.

Terminal 1:
```bash
cd server
npm install
cp .env.example .env
npm run hash-password -- "Escribe-una-clave-larga-y-segura"
```
Copia el hash que imprime el comando en `ADMIN_PASSWORD_HASH` dentro de `server/.env`. Cambia también `JWT_SECRET` por una cadena aleatoria larga y define `ADMIN_EMAIL`. No publiques `.env`.

Luego inicia la API:
```bash
npm run dev
```

Terminal 2:
```bash
cd client
npm install
npm run dev
```
Abre la URL local que Vite muestra (normalmente http://localhost:5173). El frontend hace proxy de `/api` hacia `http://localhost:3001`.

## Funcionalidades
- Formulario validado en frontend y backend; guarda mensajes en SQLite.
- Login administrativo con contraseña almacenada como hash bcrypt, JWT con vencimiento y limitación de intentos.
- Listado protegido de mensajes de contacto.
- Asistente Eco-Snacks con respuestas locales; si se configura `OPENAI_API_KEY`, intenta usar la API de OpenAI y vuelve al modo local si falla.
- Endpoint de comprobación: `GET /api/health`.

## Pruebas manuales sugeridas
1. Enviar un mensaje desde Contacto y verificar el mensaje de éxito.
2. Enviar un email inválido o un mensaje demasiado corto; el servidor debe rechazarlo.
3. Iniciar sesión en Administración con el email configurado y la contraseña original usada para generar el hash.
4. Consultar los mensajes; abrir `/api/admin/messages` sin token debe devolver `401`.
5. Preguntar al asistente por precio, entregas y productos.
6. Reiniciar el backend y verificar que los mensajes sigan en la base SQLite.

## GitHub
Desde la carpeta raíz:
```bash
git init
git add .
git commit -m "Crear aplicación Eco-Snacks"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/ecosnacks-web.git
git push -u origin main
```
Crea antes el repositorio vacío en GitHub. No subas `server/.env`, contraseñas, hashes privados ni claves de IA.

## Despliegue
La aplicación requiere un servicio que ejecute Node.js y permita almacenamiento persistente para SQLite, o sustituir SQLite por una base de datos gestionada. Configura las variables de `server/.env.example` en el panel del proveedor, `NODE_ENV=production` y `CLIENT_ORIGIN` según tu dominio. Construye el frontend con `cd client && npm install && npm run build`, instala las dependencias del servidor y ejecuta `npm start` desde `server`. El backend sirve `client/dist` en producción cuando se ejecuta con `NODE_ENV=production`.

**Importante:** en hosting con sistema de archivos efímero, SQLite puede perder los datos al reiniciar o desplegar. Usa un disco persistente o una base gestionada. No pongas `OPENAI_API_KEY` en el frontend. Para publicar el servicio, prueba login, formulario, persistencia y CORS en el dominio real.
