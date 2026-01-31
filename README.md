# ChatControl — MVP Sistema de Chat Profesional

Sistema web para responder mensajes de WhatsApp desde una plataforma propia, con respuestas manuales y asistidas por IA (Gemini).

## Stack

- **Frontend:** Next.js 14 (App Router, TypeScript) — `ChatControl-Front`
- **Backend:** NestJS (TypeScript) — `ChatControl-Back`
- **Base de datos:** PostgreSQL (Supabase) + Prisma ORM
- **WhatsApp:** WhatsApp Cloud API (oficial, sin librerías no oficiales)
- **IA:** Google Gemini API

## Requisitos

- Node.js 18+
- PostgreSQL (p. ej. Supabase)
- Cuenta Meta for Developers (WhatsApp Business API)
- API Key de Google Gemini (Google AI Studio)

## Configuración

### Backend (`ChatControl-Back`)

```bash
cd ChatControl-Back
cp .env.example .env
# Editar .env con:
# - DATABASE_URL (PostgreSQL, ej. Supabase)
# - JWT_SECRET, APP_LOGIN_PASSWORD
# - WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN
# - GEMINI_API_KEY (crear en https://aistudio.google.com/apikey con la misma cuenta Google)
npm install
npx prisma generate
npx prisma migrate dev   # crea tablas Contact, Conversation, Message
npm run start:dev
```

El backend corre en `http://localhost:3001`.

#### Si falla la migración: "Can't reach database server" (P1001)

1. **Proyecto pausado:** En [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto. Si dice "Project paused", pulsa **Restore project** y espera unos minutos.
2. **Probar conexión por pooler:** Si la conexión **Direct** (`db.xxx.supabase.co:5432`) falla, usa la **Connection pooling**:
   - En Supabase: **Project Settings** → **Database** → **Connection string**.
   - Elige **URI** y **Session mode** (puerto **5432** en `pooler.supabase.com`) o **Transaction mode** (puerto **6543**).
   - **Session mode (5432):**  
     `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require&connect_timeout=30`
   - **Transaction mode (6543):** añade `pgbouncer=true` (Prisma lo necesita):  
     `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&connect_timeout=30`
3. **Contraseña:** Sin espacios ni caracteres raros; si tiene `@`, `#`, `%`, codifícalos en la URL (`%40`, `%23`, `%25`).
4. **Bans de red:** En Supabase → **Project Settings** → **Database** → **Network Bans**. Si tu IP está baneada, quítala.
5. **Red:** Prueba sin VPN o desde otra red; algunos firewalls bloquean el puerto 5432.

### Frontend (`ChatControl-Front`)

```bash
cd ChatControl-Front
cp .env.local.example .env.local
# Editar .env.local: NEXT_PUBLIC_API_URL=http://localhost:3001
npm install
npm run dev
```

El frontend corre en `http://localhost:3000`.

### WhatsApp Webhook

Para que los mensajes enviados desde WhatsApp aparezcan en la app:

1. **El backend debe ser accesible desde internet.** En local, usa [ngrok](https://ngrok.com) (ej. `ngrok http 3001`) y usa la URL pública como `TU_DOMINIO`.  
   **Instalar ngrok en Windows:** `winget install ngrok.ngrok` o desde [Microsoft Store](https://apps.microsoft.com/detail/ngrok/9n4svt4f5g9p), o descargar en [ngrok.com/download](https://ngrok.com/download). Luego ejecuta `ngrok config add-authtoken TU_TOKEN` (token gratuito en ngrok.com).
2. En Meta for Developers, configurar la URL del webhook:
   - **URL de devolución de llamada (Callback URL):** debe incluir la ruta del endpoint: `https://TU_DOMINIO/whatsapp/webhook` (ej. `https://biflex-lumpier-emanuel.ngrok-free.dev/whatsapp/webhook`). No uses solo el dominio.
   - **Token de verificación:** exactamente el mismo valor que `WHATSAPP_VERIFY_TOKEN` en `.env` del backend.
3. **Suscribirse al campo "messages"** en "Campos del webhook" para que Meta envíe los mensajes entrantes.
4. **Enviar mensajes (app en desarrollo):** Si aparece "Application does not have permission for this action", en Meta for Developers → tu app → **Roles** (o **WhatsApp** → **Números de teléfono**) añade tu número personal como **número de prueba** para poder enviar mensajes desde la app.
5. El frontend refresca conversaciones y mensajes cada 8 segundos; los mensajes entrantes aparecerán sin recargar la página.

## Uso

1. **Login:** Número de teléfono + contraseña fija definida en `APP_LOGIN_PASSWORD` (backend).
2. **Conversaciones:** Se listan las conversaciones (los mensajes entrantes se registran vía webhook).
3. **Ventana 24h:** Solo se pueden enviar mensajes libres si el usuario escribió en las últimas 24 horas. La UI indica si está dentro o fuera de la ventana.
4. **Acciones por mensaje:**
   - **Responder con IA automática:** genera respuesta con Gemini y la envía sin validación.
   - **Generar respuesta con IA:** genera respuesta y la muestra en un campo editable; el usuario puede modificar y enviar.
   - **Responder manualmente:** escribir en el campo y enviar.

## Estructura del proyecto

```
HACKATON/
├── ChatControl-Back/       # NestJS
│   ├── prisma/
│   │   ├── schema.prisma   # Contact, Conversation, Message + enums
│   │   └── README.md       # Explicación del esquema
│   ├── src/
│   │   ├── prisma/         # PrismaService, PrismaModule
│   │   ├── auth/           # Login JWT (teléfono + contraseña)
│   │   ├── whatsapp/        # Webhook + envío (Cloud API)
│   │   ├── chat/            # Conversaciones, mensajes (Prisma), validación 24h
│   │   ├── ai/              # Gemini
│   │   └── common/          # Servicio ventana 24h
│   └── .env.example
├── ChatControl-Front/       # Next.js
│   ├── public/assets/images/   # Logo (logo-mensaje.png)
│   ├── app/
│   │   ├── login/            # Logo, animaciones (fade-in, slide-up, spinner)
│   │   ├── chat/
│   │   └── ...
│   └── lib/api.ts
└── README.md
```

## Seguridad

- Tokens y secretos solo en `.env` (backend) y `.env.local` (frontend); nunca en el código ni expuestos al frontend.
- Rutas de chat protegidas con JWT.
- Validación de ventana de 24h en el backend antes de enviar cualquier mensaje.

## TODOs / Futuras mejoras

- Multi-empresa: companyId en Contact/Conversation, token de IA por empresa, usuarios por tenant.
- Templates de WhatsApp para mensajes fuera de ventana 24h (cuando se requiera).
- Refresco periódico de conversaciones y mensajes en el frontend (polling o WebSockets).
