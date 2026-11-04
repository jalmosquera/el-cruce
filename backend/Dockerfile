FROM ghcr.io/astral-sh/uv:0.9.24 AS uv

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/app/.cache/uv \
    XDG_CACHE_HOME=/app/.cache

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app --home /app app
RUN chown app:app /app && install -d -o app -g app /app/.cache/uv

COPY --from=uv /uv /uvx /bin/
COPY --chown=app:app pyproject.toml uv.lock ./

USER app
RUN uv sync --frozen --no-install-project

COPY --chown=app:app . .
RUN uv sync --frozen
RUN DJANGO_SETTINGS_MODULE=config.settings.test \
    DJANGO_SECRET_KEY=build-only-django-secret-key-at-least-32-characters \
    JWT_SIGNING_KEY=build-only-jwt-signing-key-at-least-32-characters \
    POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55435 POSTGRES_DB=elcruce_build \
    POSTGRES_USER=build POSTGRES_PASSWORD=build-only-password \
    uv run python manage.py collectstatic --noinput

EXPOSE 8000

CMD ["uv", "run", "gunicorn", "--config", "gunicorn.conf.py", "config.wsgi:application"]
