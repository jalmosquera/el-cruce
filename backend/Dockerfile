FROM ghcr.io/astral-sh/uv:0.9.24 AS uv

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app --home /app app

COPY --from=uv /uv /uvx /bin/
COPY --chown=app:app pyproject.toml uv.lock ./

USER app
RUN uv sync --frozen --no-install-project

COPY --chown=app:app . .
RUN uv sync --frozen

EXPOSE 8000

CMD ["uv", "run", "python", "manage.py", "runserver", "0.0.0.0:8000"]
