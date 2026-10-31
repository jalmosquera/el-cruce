# El Cruce

Development foundation for a proposed internal restaurant and accommodation management platform. El Cruce is not the establishment's official system, has not been commissioned, and is not deployed to production.

## Current status

Already integrated into `dev`:

- Django and Django REST Framework backend configured for PostgreSQL.
- Identity and authentication API with `login`, `refresh`, `logout`, and `me`. The JWT access token is kept only in client memory; the refresh token is sent in an HttpOnly cookie, and `refresh` and `logout` require CSRF protection, rotation, and revocation.
- React, Vite, and Tailwind CSS frontend with the public landing page.
- Rooms backend and API.
- Multilingual menu backend and API.
- Employees and shifts backend and API.
- Guests backend and API for internal management.
- Authenticated admin dashboard shell.
- Automated backend and frontend tests, plus independent linting and coverage.
- Continuous integration workflow.
- Local Docker Compose environment for frontend, backend, and PostgreSQL.

Current working branch, pending owner review and merge:

- Public menu UI at `/carta`, with language selection and content published from the menu.

Not yet integrated into `dev`:

- Reservations.
- QR codes.
- Publishing and production configuration strategy.

The project scope includes reservations, QR codes, and manageable content, but only the functionality listed above should be treated as available.

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
npm run test:prerender
npm run build
npm run verify:prerender
```

For the isolated browser suite, install Chromium once and build before running E2E:

```fish
cd frontend
npm run e2e:install
npm run build
npm run e2e
```

The suite always uses the fixed `elcruce-e2e` project from `compose.e2e.yaml`, temporary PostgreSQL storage, and deterministic fictitious data; it cannot override the URL or Compose file, or reuse a server. It never uses preview data or the normal local Compose data. See [`docs/development.md`](docs/development.md) for Docker requirements and interactive execution.

The configuration enforces at least 80% coverage independently for the backend and frontend. See [`docs/development.md`](docs/development.md) for lint commands and [`backend/README.md`](backend/README.md) for safe backend test setup.

## Public static files and SEO

The frontend build generates a minimal static output for `/`, the canonical localized menu routes `/carta/es`, `/carta/en`, `/carta/fr`, `/carta/de`, and `/carta/it`, and the private `/dashboard` shell: public-route metadata, `sitemap.xml`, `robots.txt`, and semantic fallback HTML. Every localized menu has its own `lang`, generic localized title and description, self-canonical URL, and complete `hreflang` set. It does not embed dishes or other live data; the SPA loads published content from the API when opened. `/carta` and the legacy `/carta?language=<language>` format remain compatible; `/carta` canonicalizes to `/carta/es`, and query URLs are excluded from the sitemap.

Before building for a published environment, set the approved HTTPS origin without a path or secrets. In Fish:

```fish
set -lx PUBLIC_SITE_URL https://public.example
cd frontend
npm run build
npm run verify:prerender
```

`PUBLIC_SITE_URL` is a public build variable and is not included in the browser bundle. It must be an absolute HTTPS origin without credentials, a path, query, or fragment; when it is unset, the generator uses `https://elcruce.example` only for local artifacts. Hosting must upload the complete `frontend/dist` directory, retain `sitemap.xml` and `robots.txt`, serve `carta/index.html` directly for `/carta`, and serve each `carta/<language>/index.html` at its localized canonical URL. Public SPA routes without a static file use `index.html`; `/dashboard` plus nested dashboard routes must use `dashboard/index.html` (or return `X-Robots-Tag: noindex`). `robots.txt` blocks dashboard crawling as defense in depth, but does not by itself guarantee noindex. Selecting and configuring the hosting provider remains pending approval.

## Current limitations

- Production configuration, deployment, and the publishing strategy are pending approval.
- Internal reservations are integrated: the API exposes authentication, rooms, menu, employees and shifts, guests, and reservations. Permanent QR codes are still pending integration; their PR is under review.
- The public menu UI lives on the current working branch and is pending review and merge.
- Do not use real personal data, credentials, or secrets in the repository.
