# Value at Risk API Prototype

Prototype FastAPI service that supplies mocked Value at Risk data for the dashboard.

## Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) for dependency management (see project guidelines)

## Quickstart

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

The service exposes:

- `GET /health` – health probe
- `GET /api/v1/var/summary` – latest VaR summary (portfolio + asset level)
- `GET /api/v1/var/timeseries?ric=JP_EQUITY&days=30` – synthetic time-series window

## Tests

Backend checks are implemented with `unittest` under `tests/` and can be executed via:

```bash
uv run python -m unittest backend.tests.test_var_api
```

> **Note**
> Run the above command inside the backend container when using Docker:
>
> ```bash
> docker compose exec backend bash
> uv run python -m unittest backend.tests.test_var_api
> ```

## Database

The API reads from ClickHouse via `app/db_ch/*` (configured by `CHDB_*` settings in `.env`).

If you want to run the API without ClickHouse (UI smoke test / local dev), set `VAR_DATA_SOURCE=demo` to return deterministic demo payloads.

## Docker

The root `docker-compose.yml` builds this service into the `backend` container. To rebuild just the backend image run:

```bash
docker compose build backend
```

The container entrypoint launches Uvicorn on port `8000` (proxied by nginx on port `80`).

## Configuration

Environment variables are configured via `.env` (see `.env.example` in the repository root).

- `PROXY_URL` / `NO_PROXY` support routing outbound HTTP requests through a proxy when integration points are introduced.
- `CORS_ORIGINS` should be provided as a JSON array (e.g. `['http://localhost:3000','http://localhost:3100']`).
- `VAR_DATA_SOURCE` controls data loading (`auto` / `demo`).
