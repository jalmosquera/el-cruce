# Development quality checks

Run these commands from their respective application directories before opening a pull request.

## Backend

```fish
cd backend
uv run --locked ruff check .
```

## Frontend

```fish
cd frontend
npm run lint
npm run test:prerender
npm run coverage
npm run build
npm run verify:prerender
```

The automated test and coverage commands are documented with their respective testing foundations. Coverage thresholds remain independent: at least 80% for backend and frontend.

## Browser E2E (Playwright)

The E2E suite runs Chromium only against `compose.e2e.yaml`. It creates a separate Docker Compose project with a PostgreSQL data directory mounted as `tmpfs`, migrates and deterministically seeds only fictitious E2E users, rooms, guests, menu content, reservations, shifts, and a QR record. It never connects to the normal Compose database, a preview database, or existing local records. The disposable stack is removed automatically, including volumes, when the suite finishes.

Install the Chromium browser once after `npm ci`:

```fish
cd frontend
npm run e2e:install
```

Build first when running the prerender-artifact assertion, then execute the suite:

```fish
cd frontend
npm run build
npm run e2e
```

Docker Desktop must be running. `npm run e2e` always starts the fixed `elcruce-e2e` Compose project from `compose.e2e.yaml` at `http://127.0.0.1:9001`, with Vite proxying `/api` only to the isolated E2E Django service. The target URL, Compose file and project name cannot be overridden. Every run tears the stack down, including volumes, so it cannot reuse a developer, preview or production server. The seeder also requires `EL_CRUCE_E2E=1`, an `elcruce_e2e*` database name, and the Compose-only `db` host before it writes data. To inspect a failure interactively, use `npm run e2e:headed`; Playwright writes traces, screenshots, videos, and HTML reports under ignored frontend test-result/report directories.

The E2E workflow is manual (`Browser E2E`) rather than a pull-request gate, so the existing fast CI remains independent of Docker/browser availability.

`npm run build` invokes the dependency-free Vite prerender hook. Set `PUBLIC_SITE_URL` to the approved public HTTPS origin before producing a hosting artifact; it rejects HTTP URLs, credentials, paths, queries, and fragments. If it is absent, generated local files use `https://elcruce.example`. `npm run verify:prerender` verifies the required generated public HTML, the noindex dashboard shell, sitemap, and robots elements after the build. The canonical localized menu URLs are `/carta/es`, `/carta/en`, `/carta/fr`, `/carta/de`, and `/carta/it`; each emits its own language-tagged artifact, self-canonical URL, complete hreflang set, and sitemap entry. `/carta` and `/carta?language=<language>` remain runtime compatibility URLs, but `/carta` canonicalizes to `/carta/es` and query URLs are not included in the sitemap. Hosting must route `/dashboard` and nested dashboard paths to `dist/dashboard/index.html`, or return `X-Robots-Tag: noindex`, rather than using the generic public SPA fallback. The `robots.txt` dashboard disallow remains defense in depth and is not a standalone noindex guarantee.
