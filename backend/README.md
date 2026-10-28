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

The test configuration collects `tests/`, runs branch coverage for `config` and
`identity`, and fails if total coverage is below 80%. It writes `coverage.xml` for CI;
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
roles are `administrator`, `manager`, and `employee`; all may access only this
self endpoint. The detailed role-to-resource permission matrix remains outside
FEAT-02 and requires approval before domain endpoints are added.

Without a Bearer access token, `GET /api/auth/me/` returns `401 Unauthorized`:

```json
{
  "detail": "Las credenciales de autenticación no se proveyeron."
}
```

Access tokens last five minutes. Refresh tokens last seven days, rotate on use,
and use the SimpleJWT blacklist application for revocation.

## Menu API contract

`GET /api/menu/public/?language={language}` is public and returns only published
categories containing published dishes. `language` accepts `es` (the default),
`en`, `fr`, `de`, or `it`; another value returns `400`. For a requested foreign
language, persisted translations provide `name` and `description`, while
`spanish_name` and `spanish_description` always preserve the Spanish source.
When no translation exists, `name` and `description` predictably fall back to
Spanish and `translation_available` is `false`.

```json
{
  "language": "en",
  "categories": [{
    "id": 1,
    "name": "Starters",
    "spanish_name": "Entrantes",
    "translation_available": true,
    "dishes": [{
      "id": 10,
      "visible_number": 7,
      "name": "Spanish omelette",
      "spanish_name": "Tortilla española",
      "description": "With potatoes and egg.",
      "spanish_description": "Con patatas y huevo.",
      "translation_available": true,
      "price": "8.50",
      "allergens": ["eggs"],
      "is_available": true
    }]
  }]
}
```

`is_available` is independent from publication: an unavailable published dish
remains visible. Internal category, dish, category-translation, and
dish-translation resources are exposed respectively at
`/api/menu/categories/`, `/api/menu/dishes/`,
`/api/menu/category-translations/`, and `/api/menu/dish-translations/`.
They are internal CRUD APIs: `GET` and `POST` use the collection URL, while
`GET`, `PUT`, `PATCH`, and `DELETE` use `{collection}{id}/`. Every internal
request requires a Bearer access token whose server-authoritative role is
`manager` or `administrator`; anonymous requests receive `401` and employees
receive `403`. Collection `GET` responses are unpaginated JSON arrays. A
successful create returns `201`, detail reads and updates return `200`, and a
successful delete returns `204` with no response body.

### Internal categories

`/api/menu/categories/` represents this request and response shape. `id` is
read-only. `spanish_name` is required and cannot be empty or whitespace only;
`is_published` defaults to `false` when omitted on creation.

```json
{
  "id": 1,
  "spanish_name": "Entrantes",
  "is_published": true
}
```

Use the same writable fields (`spanish_name`, `is_published`) for `POST`,
`PUT`, and `PATCH`. Sending `id` does not change the resource identifier.

### Internal dishes

`/api/menu/dishes/` returns and accepts the following representation. `id` is
read-only; `category` is a category ID. On `POST`, `visible_number` is required,
positive, and unique across all dishes. After creation it is immutable: a
`PUT` or `PATCH` that changes it returns `400`.

```json
{
  "id": 10,
  "category": 1,
  "visible_number": 7,
  "spanish_name": "Tortilla española",
  "spanish_description": "Con patatas y huevo.",
  "price": "8.50",
  "allergens": ["eggs"],
  "is_published": true,
  "is_available": true
}
```

`spanish_name` and `price` are required on creation. `spanish_name` cannot be
empty or whitespace only; `spanish_description` is optional. `price` is a
non-negative decimal with up to eight digits and two decimal places.
`allergens` defaults to `[]` and contains unique values from the fixed EU
vocabulary: `celery`, `cereals_with_gluten`, `crustaceans`, `eggs`, `fish`,
`lupin`, `milk`, `molluscs`, `mustard`, `nuts`, `peanuts`, `sesame`,
`soybeans`, and `sulphur_dioxide_and_sulphites`. `is_published` defaults to
`false` and `is_available` to `true`.

### Internal translations

Category translations use `/api/menu/category-translations/` and dish
translations use `/api/menu/dish-translations/`. Both endpoints support the
same CRUD methods and language rule: `language` must be exactly one of `en`,
`fr`, `de`, or `it`, and each parent resource can have only one translation for
each language. `id` is read-only.

```json
{
  "id": 4,
  "category": 1,
  "language": "en",
  "name": "Starters",
  "is_manually_reviewed": true
}
```

```json
{
  "id": 8,
  "dish": 10,
  "language": "en",
  "name": "Spanish omelette",
  "description": "With potatoes and egg.",
  "is_manually_reviewed": true
}
```

For category translations, `category`, `language`, and `name` are required;
`is_manually_reviewed` defaults to `false`. For dish translations, `dish`,
`language`, and `name` are required; `description` is optional and
`is_manually_reviewed` defaults to `false`. No automated translation writer
exists in this domain, so manually reviewed content is never overwritten
automatically.

### Internal validation and errors

Invalid request data returns `400 Bad Request` with DRF's field-to-list error
shape. Examples include an unsupported language, duplicate translation, blank
Spanish source name, non-positive or duplicate dish number, invalid price, and
an attempted dish-number change:

```json
{
  "visible_number": ["This field cannot be changed after creation."]
}
```

```json
{
  "language": ["<localized invalid-choice message>"]
}
```

For an unsupported translation language, the validation error is associated
with the `language` field and has DRF's `invalid_choice` error code. Clients
must not depend on the localized message text.

An unknown detail ID returns `404 Not Found`. Foreign-key references must point
to an existing internal resource. Database constraints also protect the Spanish
source-name and translation-language invariants if data is written outside
these APIs; dish-number immutability is an API-level update rule.
