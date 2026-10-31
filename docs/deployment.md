# Preparación de producción: frontend estático y backend Django

Este documento prepara configuración sin crear proyectos, recursos, dominios,
secretos ni despliegues. La elección final de proveedores sigue pendiente de
aprobación; las referencias a Vercel y Railway describen los archivos presentes,
no una topología publicada.

## Frontend estático

Si se aprueba Vercel, configurá el proyecto con `frontend/` como *Root Directory*. El archivo
`frontend/vercel.json` ejecuta `npm run build` y publica `dist/`. El build genera
los artefactos estáticos públicos `/`, `/carta`, `/carta/es`, `/carta/en`,
`/carta/fr`, `/carta/de`, `/carta/it`, `sitemap.xml` y `robots.txt`.

No hay una reescritura global al shell de React: Vercel puede servir primero los
artefactos prerenderizados y conservar sus metadatos SEO. Sólo `/dashboard/*` y
`/login` se reescriben a `dashboard/index.html`; ambos reciben
`X-Robots-Tag: noindex, nofollow`. La página de dashboard también contiene su
propio meta `robots` como defensa adicional.

En la configuración de build de Vercel, definí estos valores públicos:

```text
VITE_API_BASE_URL=https://api.<approved-domain>/api
PUBLIC_SITE_URL=https://api.<approved-domain>
```

`VITE_API_BASE_URL` termina dentro del bundle y no puede incluir secretos,
credenciales ni tokens. `PUBLIC_SITE_URL` sólo alimenta el prerender y debe ser
un origen HTTPS absoluto sin ruta, query, fragmento ni credenciales.

## Backend Django

Si se aprueba Railway, configurá el servicio con `backend/` como *Root Directory*. El
`backend/railway.toml` usa el Dockerfile existente y arranca:

```sh
uv run gunicorn --config gunicorn.conf.py config.wsgi:application
```

Railway debe exponer el servicio únicamente a través de su terminación HTTPS y
comprobar `GET /healthz/`. Django confía en el encabezado de proxy HTTPS para ese
proxy concreto, redirige solicitudes HTTP y habilita HSTS de un año sin incluir
subdominios ni precarga. No se debe abrir PostgreSQL públicamente.

Variables requeridas en Railway, siempre desde su almacén de variables y nunca
desde Git:

```text
EL_CRUCE_ENVIRONMENT=production
DJANGO_SECRET_KEY=<secreto único de alta entropía>
JWT_SIGNING_KEY=<secreto distinto de alta entropía>
DJANGO_ALLOWED_HOSTS=api.<approved-domain>
DJANGO_CORS_ALLOWED_ORIGINS=https://app.<approved-domain>
DJANGO_CSRF_TRUSTED_ORIGINS=https://app.<approved-domain>
DJANGO_COOKIE_DOMAIN=.<approved-domain>
PUBLIC_SITE_URL=https://app.<approved-domain>
DATABASE_URL=<referencia segura a PostgreSQL Railway o URL PostgreSQL completa>
```

Como alternativa a `DATABASE_URL`, se pueden proveer `POSTGRES_HOST`,
`POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`. Las listas
de CORS y CSRF admiten varios orígenes separados por comas, pero sólo HTTPS
explícito: no se permiten `*`, paths ni credenciales.

`PUBLIC_SITE_URL` es el único origen HTTPS público que se codifica en las
exportaciones QR permanentes como `https://…/q/<identifier>/`. Debe ser el
origen aprobado que sirve esa ruta pública y no puede contener credenciales,
path (salvo una barra final opcional), query, fragmento ni comodines. En
producción no tiene valor por defecto: Django no inicia si falta o es inválido.
No inventes ni configures un dominio real antes de su aprobación.

## Cookies, CSRF y autenticación entre orígenes

La autenticación de navegador requiere una topología HTTPS del mismo sitio, que
debe aprobarse antes de configurarla:

- frontend: `https://app.<approved-domain>`;
- backend: `https://api.<approved-domain>`;
- dominio de cookies: `.<approved-domain>`;
- `DJANGO_CORS_ALLOWED_ORIGINS` y `DJANGO_CSRF_TRUSTED_ORIGINS`: la URL exacta
  `https://app.<approved-domain>`.

No uses comodines, rutas ni dominios de proveedor en esas variables. Django
aplica el dominio compartido a sus cookies CSRF y de sesión, y a la cookie
HttpOnly de refresh. Todas conservan `Secure; SameSite=Lax`; refresh y logout
siguen exigiendo el token CSRF. CORS no reemplaza CSRF.

Los dominios arbitrarios de proveedores como Vercel y Railway son cross-site.
La autenticación de navegador basada en cookies está **no soportada** en esos
dominios, incluso con CORS explícito, porque el navegador puede bloquear las
cookies de terceros. No habilites ese flujo hasta disponer de subdominios
personalizados aprobados bajo el mismo dominio registrable.

## Migraciones y recuperación

No agregues `migrate` al comando de inicio. Para cada release autorizado:

1. Confirmá que existe un backup restaurable y que la migración fue revisada.
2. Ejecutá `uv run python manage.py migrate --plan` como comando único en Railway.
3. Tras aprobación, ejecutá `uv run python manage.py migrate` una sola vez.
4. Verificá el healthcheck y el flujo funcional afectado.

Una migración fallida requiere detener nuevos intentos y aplicar el procedimiento
de rollback o restauración aprobado. No se autorizan borrados de datos, volúmenes
ni restauraciones destructivas como parte de este procedimiento.
