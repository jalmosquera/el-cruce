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
proxy concreto y redirige solicitudes HTTP. HSTS inicia desactivado hasta que un
dominio personalizado aprobado sirva HTTPS correctamente. No se debe abrir
PostgreSQL públicamente.

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

## Estáticos, errores y logs

El build del backend ejecuta `collectstatic --noinput` y deja los archivos en
`/app/staticfiles` (`STATIC_ROOT`). No se agregó WhiteNoise porque el backend no
usa Django Admin ni sirve HTML público: Gunicorn **no debe** exponer `/static/`.
Cuando exista una topología de producción aprobada, su proxy o almacenamiento
estático debe publicar exclusivamente ese directorio bajo `/static/`.

DRF usa sólo `JSONRenderer` en producción. Errores de rutas y fallos inesperados
bajo `/api/` devuelven JSON seguro sin traza, rutas internas, credenciales ni
detalles de base de datos. Los errores ya estables de validación, autenticación y
permisos de DRF se conservan para no romper consumidores.

El backend escribe eventos JSON por stdout con `timestamp`, `level`, `logger` y
`message`. `DJANGO_LOG_LEVEL` acepta solamente `CRITICAL`, `ERROR`, `WARNING`,
`INFO` o `DEBUG`; su valor seguro por defecto es `INFO`. El formateador elimina
campos y patrones de secretos conocidos, pero no sustituye la regla operativa:
nunca registrar cuerpos de autenticación, cookies, URLs de base de datos ni
tokens.

## HSTS y secretos

Variables HSTS de producción:

```text
DJANGO_HSTS_SECONDS=0
DJANGO_HSTS_INCLUDE_SUBDOMAINS=false
DJANGO_HSTS_PRELOAD=false
```

Los booleanos son estrictos (`true/false`, `yes/no`, `on/off` o `1/0`) y los
segundos deben ser enteros no negativos. Después de validar HTTPS en todos los
subdominios aprobados, se puede proponer elevar los segundos. La precarga exige
explícitamente `DJANGO_HSTS_SECONDS >= 31536000` y subdominios habilitados; no la
actives sin aprobación porque resulta difícil de revertir en los navegadores.

`DJANGO_SECRET_KEY` y `JWT_SIGNING_KEY` son secretos distintos, de al menos 50
caracteres en producción. Generarlos fuera de Git y del historial de shell, por
ejemplo con el gestor de secretos aprobado o `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
Rotar uno por vez en una ventana aprobada: respaldar y verificar primero, cambiar
el secreto en el almacén, desplegar, probar autenticación; rotar `JWT_SIGNING_KEY`
invalida tokens existentes y exige reingreso. Nunca imprimir, pegar en tickets ni
usar los valores de `.env.example`.

## Backups, restauración y drill

Los scripts `scripts/backup-postgres.sh`, `scripts/restore-postgres.sh` y
`scripts/restore-drill-postgres.sh` requieren herramientas cliente PostgreSQL
(`pg_dump`, `pg_restore`, `psql`, `createdb` y `dropdb`). Guardar los dumps cifrados
en almacenamiento con acceso limitado y conservarlos según una política aprobada.
El script de backup usa formato custom y no sobrescribe archivos existentes.

La restauración sólo acepta bases cuyo nombre empieza con `elcruce_restore_` o
`elcruce_disposable_`, y requiere que `RESTORE_CONFIRM_TARGET` repita exactamente
el nombre objetivo. Nunca apuntar `RESTORE_DATABASE_URL` a una base operativa.

El drill automatizado requiere dos URLs de una instancia PostgreSQL descartable en
el puerto `55435`, el marcador literal `elcruce-restore-drill` y una fuente también
marcada como descartable. Crea una única base temporal con prefijo
`elcruce_restore_drill_`, hace dump/restauración, compara las tablas públicas y sus
conteos de filas, y elimina sólo esa base que creó. No acepta puertos ni nombres de
producción.

Ejemplo para el propietario en Fish, usando únicamente valores descartables
aprobados y sin poner credenciales en el historial:

```fish
begin
  set -lx RESTORE_DRILL_SOURCE_DATABASE_URL 'postgresql://...:55435/elcruce_disposable_source'
  set -lx RESTORE_DRILL_ADMIN_DATABASE_URL 'postgresql://...:55435/postgres'
  set -lx RESTORE_DRILL_DISPOSABLE_MARKER elcruce-restore-drill
  ./scripts/restore-drill-postgres.sh
end
```

Si un despliegue o migración falla: detener la promoción, preservar los logs y el
artefacto de backup, comunicar el incidente y no repetir comandos destructivos.
Evaluar la migración con el plan aprobado; sólo un responsable autorizado puede
decidir rollback de aplicación o restauración hacia una base descartable primero.
Luego verificar esquema, conteos y el healthcheck antes de reanudar servicio.

## Migraciones y recuperación

No agregues `migrate` al comando de inicio. Para cada release autorizado:

1. Confirmá que existe un backup restaurable y que la migración fue revisada.
2. Ejecutá `uv run python manage.py migrate --plan` como comando único en Railway.
3. Tras aprobación, ejecutá `uv run python manage.py migrate` una sola vez.
4. Verificá el healthcheck y el flujo funcional afectado.

Una migración fallida requiere detener nuevos intentos y aplicar el procedimiento
de rollback o restauración aprobado. No se autorizan borrados de datos, volúmenes
ni restauraciones destructivas como parte de este procedimiento.

## Checklist de despliegue autorizado

1. Confirmar que el cambio está revisado, las pruebas y auditorías requeridas tienen evidencia y existe un backup restaurable con drill reciente.
2. Verificar secretos distintos y no-placeholder, hosts/orígenes HTTPS exactos, nivel de log válido y HSTS en el estado aprobado.
3. Verificar que la infraestructura aprobada sirve `STATIC_ROOT` sin pedir a Gunicorn que entregue archivos estáticos.
4. Revisar `migrate --plan`; ejecutar la migración sólo tras la autorización específica.
5. Desplegar el artefacto aprobado, comprobar `GET /healthz/`, un error API seguro y el flujo funcional afectado.
6. Revisar logs JSON sin datos sensibles, observar errores y documentar el resultado o activar la recuperación aprobada.

## Promoción controlada de dev a main

La promoción no es automática. Un responsable debe aprobar explícitamente cada
pull request desde `dev` hacia `main` después de revisar el diff acumulado, estado
de CI, evidencia de backups/drill y checklist de despliegue. Crear un release o
desplegar sigue requiriendo autorización separada. No se reescribe historial, no se
promueve con checks fallidos y no se ejecuta restauración contra una base real como
parte de la promoción.
