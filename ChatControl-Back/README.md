# ⚙️ ChatControl — Backend (NestJS)

El núcleo operativo de **ChatControl**, un servicio backend robusto y modular desarrollado sobre **NestJS** y **TypeScript**. Administra la autenticación, la persistencia en base de datos PostgreSQL mediante **Prisma ORM**, la integración oficial de **WhatsApp Cloud API**, y la automatización inteligente a través de **Google Gemini**.

---

## ✨ Características Clave

- **🧩 Arquitectura NestJS**: Modular, altamente escalable y limpia.
- **🗄️ Persistencia de Datos (Prisma)**: Modelado y consultas ultrarrápidas sobre **PostgreSQL** para manejar contactos, conversaciones e historiales de mensajes.
- **💬 Integración de WhatsApp Cloud API (Oficial)**:
  - Recepción de mensajes en tiempo real mediante **Webhooks**.
  - Envío de mensajes y validación rigurosa de ventana de 24 horas.
  - Soporte de modo Sandbox (pruebas de números autorizados).
- **🤖 Motor de IA (Google Gemini)**: 
  - Generación de respuestas sugeridas y automatizadas contextuales según el historial de la conversación.
- **🔒 Autenticación y Seguridad**: Rutas protegidas mediante estrategias **Passport JWT**.
- **🐳 Contenerización Completa**: Configuración lista de desarrollo y despliegue usando Docker y Docker Compose con `pnpm`.

---

## 🛠️ Stack Tecnológico

- **Core**: [NestJS 10](https://nestjs.com/)
- **ORM**: [Prisma ORM](https://www.prisma.io/)
- **Base de Datos**: PostgreSQL (ej. Supabase)
- **IA**: [Google Gemini SDK](https://aistudio.google.com/)
- **Gestor de Paquetes**: `pnpm` (Migrado desde npm para mayor velocidad y consistencia)

---

## 🚀 Requisitos e Instalación

### 1. Requisitos Previos
Asegúrate de tener instalado [Node.js 18+](https://nodejs.org/) y el gestor de paquetes `pnpm`:
```bash
npm install -g pnpm
```

### 2. Configurar Variables de Entorno
Copia el archivo de variables de entorno y edítalo con tus credenciales:
```bash
cp .env.example .env
```

Variables clave en tu archivo `.env`:
- `DATABASE_URL`: URI de conexión a PostgreSQL.
- `JWT_SECRET` / `APP_LOGIN_PASSWORD`: Parámetros de seguridad.
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`: Credenciales de Meta Developer Portal.
- `GEMINI_API_KEY`: API Key de Google AI Studio.
- `WHATSAPP_SANDBOX`: `true` para activar validación de contactos autorizados.

### 3. Instalar Dependencias
```bash
pnpm install
```

### 4. Generar Cliente de Prisma y Aplicar Migraciones
```bash
pnpm run prisma:generate
pnpm run prisma:migrate
```

### 5. Iniciar en Desarrollo
```bash
pnpm run start:dev
```

El servidor backend se levantará en [http://localhost:3001](http://localhost:3001).

---

## 🌐 Pruebas Locales de Webhooks (WhatsApp/Meta) con Ngrok

Dado que la API de Meta requiere una URL pública segura (HTTPS) para enviarnos los mensajes entrantes (webhooks) en desarrollo local, debes exponer tu servidor local usando un túnel como **Ngrok**.

### 1. Iniciar el túnel
Abre una nueva terminal en tu computadora y arranca el túnel apuntando al puerto del backend (`3001`):
```bash
npx ngrok http 3001
```

### 2. Configurar la URL en Meta Developers
1. Ve al panel de **Meta Developers > WhatsApp > Configuración**.
2. En la sección de Webhooks, haz clic en **Editar**.
3. Configura la **URL de devolución de llamada** usando tu dirección HTTPS de Ngrok, incluyendo el prefijo global `/api` que utiliza el backend:
   ```text
   https://<TU-SUBDOMINIO>.ngrok-free.app/api/whatsapp/webhook
   ```
4. En **Token de verificación**, escribe el token configurado en tu `.env` (por defecto `definir-token-de-verificacion`).
5. Haz clic en **Verificar y guardar**.

### 3. Suscribirse al evento de mensajes (Crítico)
En la lista de campos de Webhooks de Meta, busca el campo **`messages`** y haz clic en **Suscribirse** (el switch debe decir **"Suscrito"**). Sin esta suscripción activa, Meta no reenviará los chats ni los archivos multimedia a tu servidor local.

---

## 🐳 Uso con Docker

Si prefieres levantar todo el ecosistema (PostgreSQL + Backend) usando contenedores:

```bash
docker-compose up --build
```
*El contenedor de desarrollo está configurado por defecto para utilizar `pnpm` y recargar en caliente en el puerto `3001`.*

---

## 📁 Estructura del Directorio

```
ChatControl-Back/
├── prisma/               # Esquema de Prisma, migraciones y seeders de base de datos
├── src/
│   ├── ai/               # Integración con el SDK de Google Gemini
│   ├── auth/             # Módulo de autenticación y estrategias JWT
│   ├── chat/             # Controladores y servicios para gestión de conversaciones y mensajes
│   ├── common/           # Servicios transversales y utilidades (ej. validador de ventana 24h)
│   ├── prisma/           # Inicialización y servicio cliente de base de datos
│   ├── whatsapp/         # Controladores de Webhooks y cliente HTTP oficial para WhatsApp Cloud API
│   └── main.ts           # Punto de entrada de la aplicación
├── Dockerfile            # Configuración de Docker optimizada con pnpm
├── docker-compose.yml    # Configuración de Docker Compose para entorno local
├── package.json          # Definición de scripts y dependencias del proyecto
└── tsconfig.json         # Configuración del compilador TypeScript
```
