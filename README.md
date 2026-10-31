[🇬🇧 Read this documentation in English](README.en.md)

# El Cruce

Base de desarrollo para una propuesta de plataforma interna de gestión de restaurante y alojamiento. El Cruce no es un sistema oficial del establecimiento, no ha sido encargado y no está desplegado en producción.

## Estado actual

Ya integrado en `dev`:

- Backend Django y Django REST Framework configurado para PostgreSQL.
- API de identidad y autenticación con `login`, `refresh`, `logout` y `me`. El token de acceso JWT se conserva sólo en memoria del cliente; el refresh token viaja en una cookie HttpOnly, y `refresh` y `logout` exigen protección CSRF, rotación y revocación.
- Frontend React, Vite y Tailwind CSS con la landing pública.
- Backend y API de habitaciones.
- Backend y API del menú multilingüe.
- Backend y API de empleados y turnos.
- Backend y API de huéspedes para la gestión interna.
- Shell autenticado del panel de administración.
- Pruebas automatizadas de backend y frontend, más linting y cobertura independiente.
- Workflow de integración continua.
- Entorno local con Docker Compose para frontend, backend y PostgreSQL.

Rama de trabajo actual, pendiente de revisión y merge del propietario:

- Interfaz pública de la carta en `/carta`, con selector de idioma y contenido publicado desde el menú.

No integrados todavía en `dev`:

- Reservas.
- Códigos QR.
- Configuración de preparación para producción Vercel/Railway (sin recursos ni despliegue).

El alcance del proyecto incluye reservas, códigos QR y contenido administrable, pero sólo la funcionalidad enumerada arriba debe considerarse disponible.

## Arquitectura

El repositorio sigue un monolito modular: el backend centralizará los dominios de negocio y su API, PostgreSQL persistirá sus datos, y el frontend consumirá la API bajo `/api` mediante el proxy de Vite. La composición local mantiene tres servicios:

- `frontend`: Vite en <http://localhost:9000>.
- `backend`: servidor de desarrollo de Django en <http://localhost:8000>.
- `db`: PostgreSQL, accesible sólo desde la red interna de Compose.

La organización actual es:

```text
backend/   Django, configuración y pruebas
frontend/  React/Vite, estilos y pruebas
docs/      Documentación técnica
compose.yaml
```

Los directorios `docs/architecture/`, `docs/requirements/` y `docs/decisions/` están reservados para arquitectura, requisitos aprobados y decisiones registradas, respectivamente. Aún no contienen documentos publicados.

## Requisitos locales

Elegí uno de estos flujos:

- Docker Desktop con Docker Compose para ejecutar el entorno completo.
- Para la vista previa directa en macOS: Python 3.14, `uv`, Node.js 24, npm y una instancia local de PostgreSQL.

## Desarrollo con Docker Compose

1. Creá el archivo de variables de entorno a partir del ejemplo y reemplazá los valores de ejemplo por secretos locales únicos.

   ```fish
   cp .env.example .env
   ```

2. Iniciá los servicios.

   ```fish
   docker compose up --build
   ```

Compose espera el healthcheck de PostgreSQL antes de iniciar el backend y el del backend antes de iniciar el frontend. Los datos de PostgreSQL, el entorno virtual del backend y las dependencias del frontend se conservan en volúmenes con nombre.

Para detener el entorno:

```fish
docker compose down
```

`docker compose down` conserva esos volúmenes. No ejecutes `docker compose down --volumes` sin autorización explícita: elimina todos los datos locales de PostgreSQL.

## Vista previa directa en macOS

El backend lee exclusivamente variables de entorno del proceso y requiere una base PostgreSQL disponible. Configurá las variables obligatorias en Fish según [`backend/README.md`](backend/README.md), donde también se describe el aislamiento de la base de pruebas.

En una terminal, instalá las dependencias del backend e iniciá Django:

```fish
cd backend
uv sync --frozen
uv run python manage.py runserver
```

En otra terminal, instalá las dependencias del frontend e iniciá Vite:

```fish
cd frontend
npm ci
npm run dev
```

Vite se publica en `127.0.0.1:9000` y reenvía `/api` al backend en `127.0.0.1:8000` por defecto. Estos servidores son exclusivamente para desarrollo; no constituyen una estrategia de publicación.

## Calidad

Ejecutá los comandos desde el directorio indicado. Las pruebas de backend necesitan PostgreSQL y crean una base aislada llamada `test_<POSTGRES_DB>`; usá una instancia descartable y credenciales que no sean de producción.

```fish
cd backend
uv run --locked ruff check .
uv run pytest
```

```fish
cd frontend
npm run lint
npm run test:run
npm run coverage
npm run test:prerender
npm run build
npm run verify:prerender
```

La configuración exige como mínimo 80% de cobertura de forma independiente para backend y frontend. Consultá [`docs/development.md`](docs/development.md) para los comandos de lint y [`backend/README.md`](backend/README.md) para la preparación segura de pruebas del backend.

## Archivos estáticos públicos y SEO

El build del frontend genera una salida estática mínima para `/`, las rutas canónicas localizadas de carta `/carta/es`, `/carta/en`, `/carta/fr`, `/carta/de` y `/carta/it`, y el shell privado `/dashboard`: metadatos por ruta pública, `sitemap.xml`, `robots.txt` y HTML semántico de respaldo. Cada carta localizada tiene su propio `lang`, título y descripción genéricos localizados, URL canónica propia y conjunto completo de enlaces `hreflang`. No incorpora platos ni otros datos en vivo: la SPA carga el contenido publicado desde la API cuando se abre. `/carta` y el formato heredado `/carta?language=<idioma>` siguen siendo compatibles; `/carta` canonicaliza a `/carta/es` y las query URLs no se incluyen en el sitemap.

Antes de un build para un entorno publicado, definí el origen HTTPS aprobado, sin ruta ni secretos. En Fish:

```fish
set -lx PUBLIC_SITE_URL https://public.example
cd frontend
npm run build
npm run verify:prerender
```

`PUBLIC_SITE_URL` es una variable de build pública y no se incluye en el bundle del navegador. Debe ser un origen HTTPS absoluto sin credenciales, ruta, query ni fragmento; si no se define, el generador usa `https://elcruce.example` sólo para artefactos locales. El alojamiento deberá cargar el directorio `frontend/dist` completo, conservar `sitemap.xml` y `robots.txt`, servir `carta/index.html` directamente para `/carta`, y cada `carta/<idioma>/index.html` para su URL canónica localizada. Las rutas SPA públicas sin un archivo estático usan `index.html`; `/dashboard` y sus rutas anidadas deben usar `dashboard/index.html` (o devolver `X-Robots-Tag: noindex`). `robots.txt` bloquea el rastreo del dashboard como defensa en profundidad, pero por sí solo no garantiza que no se indexe. La elección y configuración del proveedor de alojamiento siguen pendientes de aprobación.

## Limitaciones actuales

- La topología Vercel/Railway está configurada en el repositorio, pero no existen recursos, dominios, secretos, despliegues, backups ni pruebas de restauración aprobados o ejecutados.
- Las reservas internas están integradas: la API expone autenticación, habitaciones, menú, empleados y turnos, huéspedes y reservas. Los códigos QR permanentes siguen pendientes de integrar; el PR correspondiente está en revisión.
- La interfaz pública de la carta está en la rama de trabajo actual, pendiente de revisión y merge.
- No se debe usar información personal real, credenciales reales ni secretos en el repositorio.
