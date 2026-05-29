# 📱 ChatControl — Frontend (Next.js)

Un frontend profesional, moderno y reactivo desarrollado con **Next.js 14**, **TypeScript** y **Tailwind CSS**. Permite a los agentes de atención al cliente gestionar conversaciones de WhatsApp en tiempo real con asistencia inteligente integrada mediante IA (Google Gemini).

---

## ✨ Características Clave

- **⚡ Interfaz Reactiva y Premium**: Diseño moderno con gradientes elegantes, animaciones fluidas con **GSAP** y micro-interacciones de alta calidad.
- **🔄 Gestión de Chats en Tiempo Real**: Visualización de conversaciones, actualización constante de mensajes entrantes e indicadores visuales de estado.
- **🤖 Asistencia con IA integrada (Gemini)**:
  - Generación de respuestas rápidas automatizadas.
  - Generación de sugerencias editables para que el agente refine antes de enviar.
- **⏱️ Indicador de Ventana de 24 horas**: Visualiza dinámicamente si el contacto está dentro o fuera de la ventana de 24 horas oficial de WhatsApp.
- **🔒 Flujo de Autenticación Seguro**: Pantalla de login elegante con animaciones integradas y validación JWT.
- **📁 Sección de Contactos Sandbox**: Permite agregar y autorizar contactos específicos en modo de prueba (Sandbox de WhatsApp).

---

## 🛠️ Stack Tecnológico

- **Core**: [Next.js 14](https://nextjs.org/) (App Router)
- **Lenguaje**: [TypeScript](https://www.typescriptlang.org/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Animaciones**: [GSAP (GreenSock)](https://greensock.com/gsap/)
- **Gestor de Paquetes**: `pnpm`

---

## 🚀 Requisitos e Instalación

### 1. Requisitos Previos
Asegúrate de tener instalado [Node.js 18+](https://nodejs.org/) y el gestor de paquetes `pnpm`:
```bash
npm install -g pnpm
```

### 2. Configurar Variables de Entorno
Copia el archivo de ejemplo para crear tu configuración local:
```bash
cp .env.local.example .env.local
```

Edita `.env.local` y especifica la URL de la API del backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Instalar Dependencias
```bash
pnpm install
```

### 4. Iniciar en Desarrollo
```bash
pnpm run dev
```

El frontend estará disponible en [http://localhost:3000](http://localhost:3000).

---

## 📁 Estructura del Directorio

```
ChatControl-Front/
├── app/                  # Rutas principales de Next.js (App Router)
│   ├── login/            # Componentes y diseño del Login
│   ├── chat/             # Consola principal de gestión de conversaciones
│   ├── layout.tsx        # Layout base con fuentes y estilos globales
│   └── page.tsx          # Redireccionador inicial
├── lib/
│   └── api.ts            # Cliente HTTP estructurado para comunicarse con el Backend
├── public/
│   └── assets/           # Logos, iconos y recursos visuales
├── postcss.config.js     # Configuración de procesado de estilos
├── tailwind.config.js    # Configuración del sistema de diseño (Tailwind)
└── tsconfig.json         # Configuración del compilador de TypeScript
```

---

## 🧼 Calidad de Código y Estilos

Para ejecutar el linter y verificar buenas prácticas en el código TypeScript y React:
```bash
pnpm run lint
```
