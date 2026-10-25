[🇬🇧 Read this documentation in English](README.en.md)

# El Cruce

## Entorno de desarrollo con Docker Compose

El entorno local de contenedores tiene exactamente tres servicios: `frontend`,
`backend` y `db` (PostgreSQL). PostgreSQL queda disponible solamente en la red
interna de Compose. El frontend y el backend se publican únicamente en el host
local:

- Frontend: <http://localhost:9000>
- Backend: <http://localhost:8000>

### Inicio

```fish
cp .env.example .env
# Editá .env y reemplazá ambos secretos de ejemplo.
docker compose up --build
```

Compose espera el healthcheck de PostgreSQL antes de iniciar el backend, y el
healthcheck del backend antes de iniciar el frontend. Los datos de la base, el
entorno virtual del backend y las dependencias del frontend usan volúmenes con
nombre.

### Detención

```fish
docker compose down
```

`docker compose down` conserva los volúmenes con nombre y los datos de
PostgreSQL. No ejecutes `docker compose down --volumes` sin autorización
explícita para eliminar todos los datos locales de la base.

### Vista previa directa en macOS

El uso de contenedores es opcional. Los flujos actuales de vista previa directa
en macOS siguen disponibles y Compose no los detiene ni los modifica. Consultá
la configuración del backend en [`backend/README.md`](backend/README.md) y,
después, ejecutá el frontend desde `frontend/` con `npm run dev`.

Esta configuración es únicamente para desarrollo. Usa el servidor de desarrollo
de Django y el de Vite; ninguno es una estrategia de publicación de producción.
