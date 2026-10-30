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

`npm run build` invokes the dependency-free Vite prerender hook. Set `PUBLIC_SITE_URL` to the approved public HTTPS origin before producing a hosting artifact; it rejects HTTP URLs, credentials, paths, queries, and fragments. If it is absent, generated local files use `https://elcruce.example`. `npm run verify:prerender` verifies the required generated public HTML, the noindex dashboard shell, sitemap, and robots elements after the build. The canonical localized menu URLs are `/carta/es`, `/carta/en`, `/carta/fr`, `/carta/de`, and `/carta/it`; each emits its own language-tagged artifact, self-canonical URL, complete hreflang set, and sitemap entry. `/carta` and `/carta?language=<language>` remain runtime compatibility URLs, but `/carta` canonicalizes to `/carta/es` and query URLs are not included in the sitemap. Hosting must route `/dashboard` and nested dashboard paths to `dist/dashboard/index.html`, or return `X-Robots-Tag: noindex`, rather than using the generic public SPA fallback. The `robots.txt` dashboard disallow remains defense in depth and is not a standalone noindex guarantee.
