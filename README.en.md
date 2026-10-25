# El Cruce

## Docker Compose development environment

The local container environment has exactly three services: `frontend`,
`backend`, and `db` (PostgreSQL). PostgreSQL is available only on the internal
Compose network. The frontend and backend are published to the local host only:

- Frontend: <http://localhost:9000>
- Backend: <http://localhost:8000>

### Start

```fish
cp .env.example .env
# Edit .env and replace both placeholder secrets.
docker compose up --build
```

Compose waits for the PostgreSQL healthcheck before starting the backend, and
for the backend healthcheck before starting the frontend. The database data,
backend virtual environment, and frontend dependencies use named volumes.

### Stop

```fish
docker compose down
```

`docker compose down` preserves named volumes and PostgreSQL data. Do not run
`docker compose down --volumes` unless deletion of all local database data has
been explicitly authorized.

### Direct macOS preview

Container use is optional. Existing direct macOS preview workflows remain
available and are not stopped or modified by Compose. See
[`backend/README.md`](backend/README.md) for backend environment setup, then
run the frontend from `frontend/` with `npm run dev`.

This configuration is for development only. It uses Django's development server
and Vite's development server; neither is a production serving strategy.
