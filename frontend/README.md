# Value at Risk Dashboard Prototype

Next.js 14 + Tailwind CSS dashboard that consumes the FastAPI backend to visualise Value at Risk insights.

## Getting Started

```bash
cd frontend
pnpm install
pnpm dev
```

By default the app queries `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`, default `/api/v1`). Run the FastAPI backend (or the docker-compose stack) so the dashboard always renders real, freshly seeded data.
When running under Docker Compose the `/api/v1` value keeps browser requests inside the nginx gateway; override it (e.g. `http://localhost:8000/api/v1`) only when you intentionally bypass nginx.

### Scripts

- `pnpm dev` – start Next.js dev server
- `pnpm build` / `pnpm start` – production build & serve
- `pnpm lint` – run ESLint
- `pnpm test` – execute Vitest + Testing Library unit tests

## Testing

A starter test (`tests/SummaryCards.spec.ts`) ensures the component layer is covered out of the gate. Extend coverage for data fetching hooks and interactive flows as features land.

## Styling & Components

- Tailwind CSS with design tokens specified in `DESIGN.md`
- Reusable primitives in `components/ui`
- Dashboard sections in `components/dashboard`
- Theme toggling handled by `useTheme` hook (`hooks/useTheme.ts`)

## Data Flow

Client components fetch from the API using the public env vars. No local mock layer is bundled—keep the backend running (or the compose stack) so the UI can read the SQLite demo dataset seeded via `app/db/seed.py`.

## Docker

For a containerised dev loop (hot reload + bind mount) use the root compose file:

```bash
docker compose up frontend backend nginx
```

This runs `pnpm dev` inside the container and proxies traffic through nginx on port `80`, so the browser experience matches production URLs while code changes apply instantly. Dependencies live in the named volume `value_at_risk_frontend_node_modules`; remove it with `docker compose down -v` if you need a clean install.

Need to change the published ports? Update `NGINX_PORT` inside `.env` and rerun `docker compose up …`—the compose file references those variables everywhere (dev server args, exposed ports, and nginx binding).
