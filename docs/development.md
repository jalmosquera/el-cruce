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
```

The automated test and coverage commands are documented with their respective testing foundations. Coverage thresholds remain independent: at least 80% for backend and frontend.
