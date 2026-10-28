# Backend operations

The backend reads configuration only from the process environment; it does not
load `backend/.env`. All environments require `DJANGO_SECRET_KEY`, a separate
`JWT_SIGNING_KEY`, and `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`,
`POSTGRES_USER`, and `POSTGRES_PASSWORD`. Empty and obvious placeholder values
are rejected. The port must be an integer from 1 through 65535.

`JWT_SIGNING_KEY` signs access and refresh JWTs and must be a distinct,
high-entropy secret from `DJANGO_SECRET_KEY`; there is intentionally no fallback
between them. Rotate it through the environment secret store when token
invalidation is acceptable, because previously issued JWTs will no longer verify.

Use Fish to export values, replacing every sample value with a real local value:

```fish
set -gx EL_CRUCE_ENVIRONMENT development
set -gx DJANGO_SECRET_KEY "a-unique-non-placeholder-development-secret"
set -gx JWT_SIGNING_KEY "a-distinct-non-placeholder-jwt-signing-key"
set -gx DJANGO_DEBUG true
set -gx DJANGO_ALLOWED_HOSTS "localhost,127.0.0.1"
set -gx POSTGRES_HOST "127.0.0.1"
set -gx POSTGRES_PORT 5432
set -gx POSTGRES_DB "elcruce_dev"
set -gx POSTGRES_USER "elcruce_app"
set -gx POSTGRES_PASSWORD "a-unique-local-password"
```

## Native Django database commands

These commands require a reachable PostgreSQL server and a role with the
required database privileges. They are provided as operational procedures; they
were not executed against a live server as part of INFRA-03 when none was
available.

```fish
# Verify the configured database connection.
uv run python manage.py shell -c "from django.db import connection; connection.ensure_connection()"

# Inspect and plan migrations without applying them.
uv run python manage.py showmigrations --plan
uv run python manage.py migrate --plan

# Apply migrations to POSTGRES_DB only after authorization.
uv run python manage.py migrate
```

For `EL_CRUCE_ENVIRONMENT=test`, Django keeps the application connection name as
`POSTGRES_DB` but creates and migrates the separate `TEST.NAME`,
`test_<POSTGRES_DB>`. The names must differ. The PostgreSQL role needs access to
the `postgres` database and permission to create the isolated test database.

```fish
set -gx EL_CRUCE_ENVIRONMENT test

# Django creates and migrates test_<POSTGRES_DB> when database tests run.
# --keepdb retains it for subsequent isolated test runs.
uv run python manage.py test --keepdb --noinput
```

`EL_CRUCE_ENVIRONMENT=production` forces `DEBUG = False`, requires explicit
`DJANGO_ALLOWED_HOSTS`, and uses the same mandatory PostgreSQL settings. It
rejects blank or obvious placeholder configuration; it never falls back to
SQLite or Django's dummy backend.

## Backend tests

Pytest always uses `config.settings.test` and Django creates only the explicit
`test_<POSTGRES_DB>` database. It never migrates or flushes `POSTGRES_DB`.
Run it against a disposable PostgreSQL instance, using a source name that is
not a development database:

```fish
set -gx EL_CRUCE_ENVIRONMENT test
set -gx DJANGO_SECRET_KEY "test-only-secret-key-not-for-production"
set -gx JWT_SIGNING_KEY "test-only-jwt-signing-key-not-for-production"
set -gx POSTGRES_HOST "127.0.0.1"
set -gx POSTGRES_PORT 55439
set -gx POSTGRES_DB "elcruce_infra05_source"
set -gx POSTGRES_USER "elcruce_test"
set -gx POSTGRES_PASSWORD "test-only-password"
uv run pytest
```

The test configuration collects `tests/`, runs branch coverage for `config`,
`guests`, and `identity`, and fails if total coverage is below 80%. It writes `coverage.xml` for CI;
the file is ignored by Git. Do not run database tests with production
credentials or a non-disposable PostgreSQL server.

## Authentication API contract

The browser client keeps the short-lived access token only in memory and sends
it as `Authorization: Bearer <access-token>`. Refresh tokens are never returned
in JSON: they use the `elcruce_refresh` HttpOnly cookie, scoped to
`/api/auth/`, with `SameSite=Lax`. It is marked `Secure` in production; local
development and tests deliberately omit that flag for HTTP.

`POST /api/auth/login/` accepts `username` and `password` and returns only:

```json
{"access": "<short-lived-jwt>"}
```

It also sets the refresh cookie and Django's readable `csrftoken` cookie.
Invalid credentials return `401 Unauthorized` and do not set an
`elcruce_refresh` cookie:

```json
{
  "detail": "No active account found with the given credentials"
}
```

`POST /api/auth/refresh/` has no body: it requires both the refresh cookie and
its `csrftoken` value in the `X-CSRFToken` header. It returns the same access
payload, replaces the refresh cookie, and blacklists the submitted token.
A missing refresh cookie returns `400`. A missing or invalid CSRF cookie/header
pair fails CSRF validation and returns `403`. Expired, malformed, blacklisted,
or replayed refresh tokens return `401`.

`POST /api/auth/logout/` requires the same CSRF protection, blacklists a valid
refresh cookie, clears it, and returns `204`. It remains idempotent when the
cookie is absent, expired, or malformed.

`GET /api/auth/me/` requires a Bearer access token and returns the authenticated
internal user's server-authoritative `id`, `username`, and `role`. Supported
roles are `administrator`, `manager`, and `employee`.

The backend enforces the following role-to-resource matrix. `employee` accounts
may authenticate but receive `403 Forbidden` from internal management APIs;
anonymous requests to protected endpoints receive `401 Unauthorized`.

| Endpoint contract | Anonymous | `employee` | `manager` | `administrator` |
| --- | --- | --- | --- | --- |
| `POST /api/auth/login/`, `/api/auth/refresh/`, `/api/auth/logout/` | Allowed; refresh and logout also require the refresh cookie and CSRF token. | Allowed | Allowed | Allowed |
| `GET /api/auth/me/` | `401` | Allowed | Allowed | Allowed |
| `GET /api/menu/public/` | Allowed | Allowed | Allowed | Allowed |
| `/api/menu/categories/`, `/api/menu/dishes/`, `/api/menu/category-translations/`, `/api/menu/dish-translations/` | `401` | `403` | Allowed | Allowed |
| `/api/rooms/` and `/api/rooms/{id}/` | `401` | `403` | Allowed | Allowed |
| `/api/employees/`, `/api/employees/{id}/`, `/api/shifts/`, `/api/shifts/{id}/` | `401` | `403` | Allowed | Allowed |
| `/api/guests/` and `/api/guests/{id}/` | `401` | `403` | Allowed | Allowed |

Detailed request and response contracts are documented per domain in the
backend repository. Authorization is always enforced on the backend and never
inferred from frontend role checks.

Without a Bearer access token, `GET /api/auth/me/` returns `401 Unauthorized`:

```json
{
  "detail": "Las credenciales de autenticación no se proveyeron."
}
```

Access tokens last five minutes. Refresh tokens last seven days, rotate on use,
and use the SimpleJWT blacklist application for revocation.

## Guest API contract

All endpoints below require a Bearer access token. Only server-authoritative
`manager` and `administrator` roles may access them; anonymous callers receive
`401` and users with the `employee` role receive `403`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/guests/` | List or create internal guest records. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/guests/{id}/` | Manage one internal guest record. |

The list response is a JSON array without pagination. Every record exposes only
the minimized operational representation:

```json
{
  "id": 7,
  "display_name": "Ana María López",
  "email": "ana.lopez@example.com",
  "phone": "+34600123456",
  "document_type": "dni",
  "document_number": "12345678Z",
  "internal_notes": "Late arrival requested.",
  "created_at": "2026-10-28T12:00:00Z",
  "updated_at": "2026-10-28T12:00:00Z"
}
```

`id`, `created_at`, and `updated_at` are read-only. The API accepts only the
fields listed above. Unknown fields, including identity-document images,
biometric data, official traveler reporting fields, and automated-messaging data,
are silently ignored: they are not rejected, stored, or returned.

Request validation normalizes data before persistence:

- `display_name` is required, has insignificant whitespace collapsed, and the
  normalized value may contain at most 150 characters.
- `email` is optional, trimmed, lowercased, and validated as an email address
  with at most 254 characters. Blank values are stored as `null`.
- `phone` is optional, trimmed, and stripped of spaces, dots, hyphens,
  parentheses, and slashes. It keeps one optional leading `+` and must contain
  between 6 and 15 ASCII digits. Blank values are stored as `null`.
- `document_type` is optional and accepts `dni`, `nie`, `passport`, or `other`
  case-insensitively. `document_number` is optional, uppercased, and stripped of
  spaces and hyphens. Both document fields must be provided together or omitted
  together.
- DNI and NIE numbers require a valid Spanish control letter. Passport numbers
  require 5 to 20 letters or digits. `other` document numbers require 3 to 32
  letters or digits.
- `internal_notes` is optional, trimmed, and the normalized value is limited to
  2000 characters.

Validation failures return `400` with field-specific errors. For example:

```json
{
  "document_type": [
    "Document type is required when a document number is provided."
  ]
}
```

PostgreSQL also enforces a non-blank display name, non-blank document numbers,
the document-field pairing, and the supported document-type list when
application validation is bypassed.
