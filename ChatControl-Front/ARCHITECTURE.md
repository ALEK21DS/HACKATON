# Arquitectura Frontend

El proyecto queda organizado con la trinidad de la imagen: FSD para capas, hexagonal para aislar negocio de infraestructura y Atomic Design para UI reutilizable.

## Capas FSD

- `src/app`: router de Next.js, layouts globales, providers y estilos globales.
- `src/pages`: composición de pantallas por caso de navegación.
- `src/widgets`: bloques grandes de interfaz reutilizables, como `sidebar` y shells.
- `src/features`: casos de uso accionables por el usuario. Cada feature puede tener `model`, `ports`, `adapters` y `ui`.
- `src/entities`: modelos de negocio estables: usuario, conversación, mensaje, contacto, plantilla y organización.
- `src/shared`: infraestructura compartida, API, configuración, utilidades y sistema UI atómico.

## Hexagonal

Cada feature separa:

- `model`: reglas, estado y tipos del caso de uso.
- `ports`: interfaces que describen lo que la feature necesita del exterior.
- `adapters`: implementación concreta contra HTTP, storage, sockets u otros servicios.

La regla es que `model` y `ports` no dependen de detalles técnicos. Los adaptadores sí conocen `fetch`, tokens, endpoints y servicios externos.

## Atomic Design

- `src/shared/ui/atoms`: botones, inputs, checkbox, labels, icon buttons.
- `src/shared/ui/molecules`: modal, campos con label, grupos de acciones.
- `src/shared/ui/organisms`: formularios completos, tablas, paneles.
- `src/shared/ui/templates`: layouts reutilizables sin datos de negocio.
- `src/shared/ui/pages`: páginas UI completas cuando no pertenecen a una feature concreta.
- `src/shared/ui/foundations`: tokens visuales y contratos base.

Los imports antiguos `@/lib/api`, `@/lib/format` y `@/components/ui/*` siguen funcionando mediante wrappers para facilitar la migración progresiva.
