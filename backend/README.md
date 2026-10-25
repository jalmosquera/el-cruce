# Backend operations

The backend reads configuration only from the process environment; it does not
load `backend/.env`. All environments require `DJANGO_SECRET_KEY` and
`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, and
`POSTGRES_PASSWORD`. Empty and obvious placeholder values are rejected. The port
must be an integer from 1 through 65535.

Use Fish to export values, replacing every sample value with a real local value:

```fish
set -gx EL_CRUCE_ENVIRONMENT development
set -gx DJANGO_SECRET_KEY "a-unique-non-placeholder-development-secret"
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
set -gx POSTGRES_HOST "127.0.0.1"
set -gx POSTGRES_PORT 55439
set -gx POSTGRES_DB "elcruce_infra05_source"
set -gx POSTGRES_USER "elcruce_test"
set -gx POSTGRES_PASSWORD "test-only-password"
uv run pytest
```

The test configuration collects `tests/`, runs branch coverage for `config`,
and fails if total coverage is below 80%. It writes `coverage.xml` for CI;
the file is ignored by Git. Do not run database tests with production
credentials or a non-disposable PostgreSQL server.
