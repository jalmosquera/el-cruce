# El Cruce

Development foundation for a proposed internal restaurant and accommodation management platform. El Cruce is not the establishment's official system, has not been commissioned, and is not deployed to production.

## Current status

Already integrated into `dev`:

- Django and Django REST Framework backend configured for PostgreSQL.
- Identity and authentication API with `login`, `refresh`, `logout`, and `me`. The JWT access token is kept only in client memory; the refresh token is sent in an HttpOnly cookie, and `refresh` and `logout` require CSRF protection, rotation, and revocation.
- React, Vite, and Tailwind CSS frontend with the public landing page.
- Automated backend and frontend tests, plus independent linting and coverage.
- Local Docker Compose environment for frontend, backend, and PostgreSQL.

Open as Pull Requests pending owner review and merge; not available in `dev`:

- Rooms backend.
- Multilingual menu backend.
- Frontend authentication and admin dashboard shell.
- Continuous integration workflow.

The employees and shifts backend lives on the FEAT-06 working branch and is pending owner review and merge.

There are still no reservations, guests, QR codes, or public menu UI. Menu, reservations, guests, rooms, employees, shifts, QR codes, and content are within the project scope, but only the functionality listed above should be treated as available.

## Architecture

The repository follows a modular monolith: the backend will centralize business domains and its API, PostgreSQL will persist its data, and the frontend will consume the API under `/api` through Vite's proxy. The local composition has three services:

- `frontend`: Vite at <http://localhost:9000>.
- `backend`: Django development server at <http://localhost:8000>.
- `db`: PostgreSQL, reachable only from the internal Compose network.

The current layout is:

```text
backend/   Django, configuration, and tests
frontend/  React/Vite, styles, and tests
docs/      Technical documentation
compose.yaml
```

The `docs/architecture/`, `docs/requirements/`, and `docs/decisions/` directories are reserved for architecture, approved requirements, and recorded decisions, respectively. They do not yet contain published documents.

## Local requirements

Choose one of these workflows:

- Docker Desktop with Docker Compose to run the complete environment.
- For direct macOS preview: Python 3.14, `uv`, Node.js 24, npm, and a local PostgreSQL instance.

## Docker Compose development

1. Create the environment file from the example and replace the placeholder values with unique local secrets.

   ```fish
   cp .env.example .env
   ```

2. Start the services.

   ```fish
   docker compose up --build
   ```

Compose waits for the PostgreSQL healthcheck before starting the backend, and for the backend healthcheck before starting the frontend. PostgreSQL data, the backend virtual environment, and frontend dependencies are retained in named volumes.

To stop the environment:

```fish
docker compose down
```

`docker compose down` preserves those volumes. Do not run `docker compose down --volumes` without explicit authorization: it deletes all local PostgreSQL data.

## Direct macOS preview

The backend reads configuration exclusively from the process environment and requires an available PostgreSQL database. Configure the required Fish environment variables as described in [`backend/README.md`](backend/README.md), which also documents test database isolation.

In one terminal, install backend dependencies and start Django:

```fish
cd backend
uv sync --frozen
uv run python manage.py runserver
```

In another terminal, install frontend dependencies and start Vite:

```fish
cd frontend
npm ci
npm run dev
```

Vite listens on `127.0.0.1:9000` and proxies `/api` to the backend at `127.0.0.1:8000` by default. These servers are for development only; they are not a publishing strategy.

## Quality

Run each command from its indicated directory. Backend tests need PostgreSQL and create an isolated database named `test_<POSTGRES_DB>`; use a disposable instance and non-production credentials.

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
```

The configuration enforces at least 80% coverage independently for the backend and frontend. See [`docs/development.md`](docs/development.md) for lint commands and [`backend/README.md`](backend/README.md) for safe backend test setup.

## Current limitations

- Production configuration, deployment, and the publishing strategy are pending approval.
- The only available endpoints are the authentication ones; there are no reservation, guest, or QR code endpoints.
- Do not use real personal data, credentials, or secrets in the repository.
