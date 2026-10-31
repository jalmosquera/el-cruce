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
set -gx PUBLIC_SITE_URL "https://elcruce.test"
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
`DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, and
`DJANGO_CSRF_TRUSTED_ORIGINS`, and `PUBLIC_SITE_URL`, and rejects blank or obvious placeholder
configuration. CORS and CSRF values are comma-separated, specific HTTPS origins;
wildcards, paths, credentials, and HTTP are rejected. CORS is limited to `/api/`
and allows credentials only for those explicit origins. The application never
falls back to SQLite or Django's dummy backend.

Production accepts either a complete `DATABASE_URL` with a `postgresql://` (or
`postgres://`) scheme, host, database, user, and password, or the explicit
`POSTGRES_*` values above. When `DATABASE_URL` is present it takes precedence;
supported connection options are `sslmode` and `connect_timeout`. Configuration
errors never log the connection URL or credentials.

## Production browser authentication topology

Cookie-based browser authentication is supported only when the public frontend
and API use HTTPS custom subdomains of one approved registrable domain:

- frontend: `https://app.<approved-domain>`;
- API: `https://api.<approved-domain>`;
- `DJANGO_COOKIE_DOMAIN=.<approved-domain>`;
- `DJANGO_CORS_ALLOWED_ORIGINS=https://app.<approved-domain>`;
- `DJANGO_CSRF_TRUSTED_ORIGINS=https://app.<approved-domain>`.

`DJANGO_COOKIE_DOMAIN` is optional in settings so non-browser or same-host
deployments can retain host-only cookies. For the two-subdomain browser flow it
is required: Django applies it consistently to CSRF and session cookies, and the
refresh-cookie helper applies it to SimpleJWT's HttpOnly refresh cookie. The
value must be a leading-dot domain without a scheme, port, path, IP address, or
wildcard. Confirm that the selected value is a registrable domain during the
approved deployment review.

Cookies remain `Secure; SameSite=Lax`; CSRF remains enforced for refresh and
logout. CORS never replaces CSRF. Arbitrary Vercel and Railway provider domains
are cross-site and are **unsupported** for browser cookie authentication, even
with explicit CORS; configure approved custom domains before enabling it.

## Railway runtime and controlled migrations

`railway.toml` expects Railway to use the backend directory as its service root,
build the existing Dockerfile, start Gunicorn, and probe `GET /healthz/`.
`/healthz/` is unauthenticated liveness only: it returns exactly
`{"status":"ok"}` and does not query or reveal the database, settings, versions,
or secrets. Gunicorn binds Railway's `PORT` and defaults to two sync workers;
set `GUNICORN_WORKERS` only after capacity testing.

The runtime image uses Gunicorn rather than Django's development server. It does
not use WhiteNoise because Django does not serve the Vite static site or Django
admin assets in this deployment: Vercel serves the complete frontend build. Adding
WhiteNoise would add a runtime dependency without an asset-serving responsibility.

Migrations are deliberately **not** part of the start command, so concurrent
restarts cannot race schema changes. An authorized operator must use the Railway
service's one-off command facility, with the production environment selected:

```sh
uv run python manage.py migrate --plan
uv run python manage.py migrate
```

Before applying, review the plan and verify a tested backup exists. Apply once per
release, wait for completion, then confirm `/healthz/` and the affected API
workflow. If a migration fails, stop further deploy attempts and use the approved
backup/rollback procedure; do not drop tables, volumes, or databases.

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
`employees`, `guests`, `identity`, `rooms`, `menu`, `qr_codes`, and `reservations`, and
fails if total coverage is below 80%. It writes `coverage.xml` for CI;
the file is ignored by Git. Do not run database tests with production
credentials or a non-disposable PostgreSQL server.

## Permanent QR public origin

QR downloads encode an absolute URL in the form
`<PUBLIC_SITE_URL>/q/<identifier>/`. `PUBLIC_SITE_URL` is a single HTTPS public
origin: it cannot contain credentials, a path (other than an optional trailing
slash), query, fragment, or wildcard. The backend normalizes an optional
trailing slash before generating a payload.

Development defaults to the deterministic reserved origin `https://elcruce.test`
when the variable is absent; tests always use that origin. Production has no
fallback: Django refuses to start without a configured approved public origin,
preventing the generation of unusable or host-dependent QR codes. Set this to
the approved public backend origin that serves `/q/<identifier>/`; do not
substitute a provider URL or invent a domain before deployment approval.

## Authentication API contract

The browser client keeps the short-lived access token only in memory and sends
it as `Authorization: Bearer <access-token>`. Refresh tokens are never returned
in JSON: they use the `elcruce_refresh` HttpOnly cookie, scoped to
`/api/auth/`, with `SameSite=Lax` locally. Production marks it `Secure` and
retains `SameSite=Lax` for the approved same-site custom-subdomain topology.
CSRF and CORS remain restricted to the exact approved frontend HTTPS origin;
see the production browser authentication topology above before enabling it.

The login and refresh endpoints ignore the `Authorization` header entirely.
A stale, expired, or malformed Bearer token must never block acquiring or
renewing credentials: both endpoints return success for valid credentials or a
valid refresh cookie regardless of the header. Login still validates
`username`/`password`, refresh still validates its cookie, and refresh CSRF
protection is unchanged.

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

## Internal user directory API contract

`GET /api/identity/users/` returns an unpaginated JSON array of internal users
for administrative selection controls. It requires a Bearer access token whose
server-authoritative role is `manager` or `administrator`; anonymous callers
receive `401` and users with the `employee` role receive `403`. Results are
ordered by ascending `username`, then `id`, and each entry exposes only:

```json
{"id": 42, "username": "maria", "role": "employee"}
```

The directory deliberately includes all internal roles. Employee profiles
currently use a foreign key serializer field with `User.objects.all()` and have
no model or serializer constraint requiring the linked user to have the
`employee` role. Filtering this directory to employees would therefore create a
frontend/API restriction that conflicts with the current employee-profile
contract. Restricting profile links to employee-role users requires a separately
approved domain-rule change.

## Rooms API contract

The internal rooms API is available only to authenticated users with the
`administrator` or `manager` role. An `employee` role receives `403 Forbidden`;
unauthenticated requests receive `401 Unauthorized`. Send the short-lived access
token as `Authorization: Bearer <access-token>`.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/rooms/` | List rooms in ascending `code` order. |
| `POST` | `/api/rooms/` | Create a room. |
| `GET` | `/api/rooms/{id}/` | Retrieve a room. |
| `PUT`, `PATCH` | `/api/rooms/{id}/` | Update mutable room fields. |
| `DELETE` | `/api/rooms/{id}/` | Delete a room. |

Room payloads expose only internal operational data:

```json
{
  "id": 1,
  "code": "101",
  "name": "Double room 101",
  "capacity": 2,
  "status": "operational"
}
```

`code` is the unique, stable human-facing room identifier and is accepted only
when creating a room; attempts to change it return `400` with a `code` field
error. `name` is required and may not be blank. `capacity` is required and must
be an integer greater than zero. `status` is required and must be one of
`operational`, `maintenance`, or `out_of_service`. Invalid input returns
`400 Bad Request` with field-to-error-list mappings, for example:

```json
{"capacity": ["Capacity must be greater than zero."]}
```

On update, `capacity` cannot be reduced below the largest `guest_count` among
the room's occupying reservations (`pending`, `confirmed`, `checked_in`). A
reduction that would leave an occupying reservation over capacity returns `400`
with a `capacity` field error whose code is
`capacity_below_occupying_guest_count`. Terminal reservations (`checked_out`,
`cancelled`, `no_show`) and their guest counts are excluded from this rule.

The serializer checks this rule before any lock, then the update runs in
`transaction.atomic()`, locks the room row with `select_for_update()`, and
rechecks it against the committed reservations. Reservation creation locks the
same room row before validating capacity and inserting, so a capacity reduction
cannot race a concurrent reservation and persist an over-capacity stay.

Deleting a room that any reservation still references — even a terminal
`cancelled` reservation — returns `409 Conflict` instead of a server error:

```json
{"detail": "This room cannot be deleted because a reservation references it."}
```

The error code is `room_in_use`.

## Menu API contract

`GET /api/menu/public/?language={language}` is public and returns only published
categories containing published dishes. The endpoint ignores authentication
headers entirely: anonymous requests and requests carrying a valid, expired, or
malformed Bearer token all return the same public menu without `401`. This does
not affect internal menu management endpoints, which still require a valid
Bearer access token. `language` accepts `es` (the default),
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

## Employee and shift API contract

All endpoints below require a Bearer access token. Only server-authoritative
`manager` and `administrator` roles may access them; anonymous callers receive
`401` and users with the `employee` role receive `403`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/employees/` | List or create minimal employee profiles. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/employees/{id}/` | Manage one employee profile. |
| `GET`, `POST` | `/api/shifts/` | List or create shift assignments. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/shifts/{id}/` | Manage one shift assignment. |

An employee profile only links an existing internal user:

```json
{"id": 12, "user": 42}
```

A shift uses timezone-aware ISO 8601 timestamps:

```json
{
  "id": 31,
  "employee": 12,
  "starts_at": "2026-11-02T09:00:00+01:00",
  "ends_at": "2026-11-02T17:00:00+01:00"
}
```

`starts_at` and `ends_at` require an explicit timezone offset, and `ends_at`
must be later than `starts_at`. PostgreSQL enforces a non-overlap invariant per
employee using `[start, end)` semantics: adjacent shifts are allowed and
intersecting shifts are rejected, including concurrent writes. Validation
failures return `400`; overlapping shifts return:

```json
{"non_field_errors": ["This employee already has an overlapping shift."]}
```

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

Deleting a guest that any reservation still references — even a terminal
`cancelled` reservation — returns `409 Conflict` instead of a server error:

```json
{"detail": "This guest cannot be deleted because a reservation references it."}
```

The error code is `guest_in_use`.

PostgreSQL also enforces a non-blank display name, non-blank document numbers,
the document-field pairing, and the supported document-type list when
application validation is bypassed.

## Reservation API contract

All reservation endpoints require a Bearer access token. Only
server-authoritative `manager` and `administrator` roles may access them;
anonymous callers receive `401` and users with the `employee` role receive
`403`. The list response is an unpaginated JSON array ordered by `check_in`
and then primary key.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/reservations/` | List or create reservations. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/reservations/{id}/` | Manage one reservation. |
| `GET` | `/api/reservations/availability/` | Find operational rooms without an occupying overlap. |

A reservation exposes only internal operational data:

```json
{
  "id": 21,
  "room": 1,
  "guest": 7,
  "check_in": "2026-11-10",
  "check_out": "2026-11-12",
  "guest_count": 2,
  "status": "pending",
  "internal_notes": "Late arrival requested.",
  "created_by": 3,
  "created_at": "2026-10-28T12:00:00Z",
  "updated_at": "2026-10-28T12:00:00Z"
}
```

`id`, `created_by`, `created_at`, and `updated_at` are read-only. `created_by`
is always the authenticated user who created the reservation and becomes
`null` if that internal user is later deleted. `room` and `guest` are required
primary keys to existing resources; both use `PROTECT`, so a room or guest
cannot be deleted while any reservation references it. `check_in` and
`check_out` are required ISO 8601 dates (`YYYY-MM-DD`).

`check_out` must be later than `check_in`. For newly created reservations,
`check_out` must also be today or later in the project's local timezone
(`Europe/Madrid`). Existing reservations may retain past dates so staff can
check them out, and updates do not reapply the creation-date rule. The
database enforces `check_out > check_in`.

`guest_count` is required, must be greater than zero, and must not exceed
`room.capacity`. Capacity is validated by the model and API because this
cross-table invariant cannot be expressed as a simple PostgreSQL check
constraint; it is rechecked after the room row is locked. The database enforces
a positive `guest_count`.

`internal_notes` is optional, may be blank, and is limited to 2000 characters.
`status` defaults to `pending` on creation and must be one of the statuses
below.

### Reservation statuses and transitions

Only `pending`, `confirmed`, and `checked_in` occupy the room. The terminal
statuses `checked_out`, `cancelled`, and `no_show` never block another
reservation.

| Current status | Allowed next statuses |
| --- | --- |
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `checked_in`, `cancelled`, `no_show` |
| `checked_in` | `checked_out` |
| `checked_out` | none |
| `cancelled` | none |
| `no_show` | none |

Sending the current status again is an accepted no-op. Any other transition is
rejected with `400` and a `status` field error whose error code is
`invalid_status_transition`.

### Overlap invariant

PostgreSQL enforces this exclusion constraint:

```sql
EXCLUDE USING gist (
  room_id WITH =,
  daterange(check_in, check_out, '[)') WITH &&
) WHERE status IN ('pending', 'confirmed', 'checked_in')
```

The `btree_gist` extension required for the equality operator is created by the
employees migration; the reservations migration declares that dependency.
Ranges are half-open `[check_in, check_out)`, so adjacent stays are valid and a
checkout day may equal another reservation's check-in day. Cancelled,
checked-out, and no-show rows are outside the constraint predicate and never
block a room.

Create and update operations run in `transaction.atomic()`, acquire
`select_for_update()` on the affected room rows before checking overlaps, and
then save. Updates lock every room the request may touch in ascending
primary-key order, then lock and re-read the reservation row. When the request
does not reassign the room, the effective room is resolved from that freshly
locked row; if a concurrent update already moved the reservation to another
room, that room is locked too and capacity and overlap are revalidated against
the fresh state. Date, capacity and status-transition rules are therefore
revalidated against committed data. Updates write only the fields supplied by
the request, so a concurrent notes edit cannot revert a status change. A `PATCH`
that changes `room` checks overlap against the target room with the same
occupying statuses and half-open range used by the exclusion constraint. This
serializes competing requests for the same room; the exclusion constraint
remains the final guarantee under concurrency. An overlap detected by the
application or by the database returns `400` with:

```json
{
  "non_field_errors": [
    "This room already has an overlapping reservation."
  ]
}
```

The error code for that message is `overlapping_reservation`. Updating an
existing reservation excludes its own row from the overlap check, so extending
or editing it does not conflict with itself.

### Concurrent update conflicts

If a concurrent update moves a reservation after the request took its pre-lock
snapshot, the effective room may only be discovered after the reservation row
is locked. That late room lock is acquired with `NOWAIT` so the request never
waits for a room while holding the reservation lock, which would invert the
lock order used by room moves and risk a PostgreSQL deadlock. When PostgreSQL
reports a lock conflict (SQLSTATE `40P01` deadlock detected or `55P03` lock not
available), the API rolls the transaction back and returns `409 Conflict`:

```json
{
  "detail": "The reservation was modified concurrently. Retry the request."
}
```

The stable error code is `reservation_conflict`. No partial update is persisted;
the client should retry the request against the committed state. The response
never exposes PostgreSQL error text or constraint details.

### Availability semantics

`GET /api/reservations/availability/?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD`
requires an increasing half-open range. A missing or malformed date returns
`400`; an inverted or empty range returns `400` with a `check_out` error whose
code is `check_out_not_after_check_in`. An optional `room` query parameter
filters by room primary key.

The endpoint returns operational rooms only (`room.status = operational`) that
have no overlapping reservation in an occupying status. Maintenance and
out-of-service rooms are never returned. Past ranges are accepted so staff can
consult historical availability.

```json
{
  "check_in": "2026-11-10",
  "check_out": "2026-11-12",
  "rooms": [
    {
      "id": 2,
      "code": "102",
      "name": "Double room 102",
      "capacity": 2,
      "status": "operational"
    }
  ]
}
```

### Reservation deletion

`DELETE` is allowed only for non-occupying reservations (`checked_out`,
`cancelled`, or `no_show`). Attempting to delete a `pending`, `confirmed`, or
`checked_in` reservation returns `400`:

```json
{"detail": "Occupying reservations cannot be deleted."}
```

The error code is `reservation_is_occupying`. Occupying reservations must first
be transitioned to a terminal status.

### Reservation validation errors

Validation failures use DRF's field-to-list error shape. Over HTTP the JSON
`detail`/field messages come from two different sources:

- DRF's built-in validator messages are translated by Django's i18n machinery.
  The project uses `LANGUAGE_CODE = "es-es"`, so a missing field is reported
  with the Spanish built-in message `"Este campo es requerido."` and code
  `required`.
- Messages written by this project are plain English and are not translated by
  Django, even though the project locale is Spanish. Examples are
  `"Guest count must be greater than zero."`,
  `"Guest count exceeds room capacity."`,
  `"Check-out must be later than check-in."`, and
  `"This room already has an overlapping reservation."`.

Do not depend on either localized built-in text or custom English text. The
machine-readable `ErrorDetail.code` is the stable contract. The JSON body
exposes only the message, not the code, so clients must follow the documented
message/code pairing or treat unknown messages as generic validation errors.

Domain error codes are stable and independent from those localized or custom
messages: `check_out_not_after_check_in`, `check_out_in_past`,
`guest_count_exceeds_capacity`, `invalid_status_transition`,
`overlapping_reservation`, and `reservation_is_occupying`. A status transition
that lost a race with a concurrent status change is rejected with the same
`invalid_status_transition` code. A lock conflict detected while revalidating a
concurrent update uses `409 Conflict` with the `reservation_conflict` code.

DRF field-level codes also apply:

- A missing `check_in` or `check_out` returns code `required` with DRF's
  localized Spanish message.
- A malformed date (for example `not-a-date`) returns code `invalid`.
- A missing `guest_count` returns code `required`; a non-integer returns
  `invalid`; a value below `1` returns `min_value` together with the project's
  untranslated English message `"Guest count must be greater than zero."`,
  because that field overrides DRF's default message.
- Invalid choice values, including an unknown `status`, use DRF's
  `invalid_choice` code.

## Permanent QR-code API contract

QR codes are managed internally and generated locally with Segno. They do not
store generated SVG or PNG blobs: each protected download is rendered from the
persisted permanent identifier when requested.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/qr-codes/` | List or create QR redirect records. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/api/qr-codes/{id}/` | Manage one QR redirect record. |
| `GET` | `/api/qr-codes/{id}/download/svg/` | Download a generated SVG. |
| `GET` | `/api/qr-codes/{id}/download/png/` | Download a generated PNG. |
| `GET` | `/q/{identifier}/` | Public stable redirect for a scanned QR code. |

The API endpoints require a Bearer access token from an `administrator` or
`manager`; anonymous callers receive `401` and employees receive `403`. SVG
and PNG downloads use `Content-Disposition: attachment`; their media types are
respectively `image/svg+xml` and `image/png`.

Create requests accept `name`, `target_path`, and optional `is_active`:

```json
{"name": "Carta terraza", "target_path": "/carta", "is_active": true}
```

Responses also expose read-only `id`, opaque `identifier`, `created_by`,
`created_at`, and `updated_at`. `created_by` is set from the authenticated
creator and becomes `null` if that user is removed. The identifier is a
random, URL-safe 32-character UUID-like value, is unique at the database
level, and is immutable through this API. It is never a database ID, user ID,
guest datum, or target URL.

### Permanence and redirect security

Every generated QR contains the absolute stable URL
`<PUBLIC_SITE_URL>/q/{identifier}/`; it never contains guest data, user data, a
direct mutable content URL, or a third-party URL. A successful public request
responds with `302 Found` to the persisted local target. A temporary redirect is intentional:
the stable QR path remains permanent while staff can change the target without
clients permanently caching the former destination. Unknown and inactive codes
return `404`.

`target_path` is not a general redirect URL. The current allowlist contains
exactly `/carta`. It must be an absolute local path and rejects schemes, hosts
(including `//host`), query strings, fragments, API/private paths, and every
unregistered route. Supporting a future public target requires updating the
explicit allowlist, its database constraint, tests, and this contract; it must
not weaken validation into a prefix or arbitrary-path policy.

The default rendering has dark `#111827` modules on white `#ffffff`, high error
correction (`H`), and a four-module quiet zone. PNG generation uses a scale of
10 pixels per module. For the current 37-module QR matrix plus the quiet zone,
this produces a 450px square, about 38mm at a 300-DPI print assumption. Actual
physical size varies with the generated QR version and output device; print
workflows must preserve the quiet zone and avoid scaling that makes modules too
small. Logo or image embedding is intentionally not implemented.
