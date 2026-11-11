# Task Portal

A small employee task and schedule portal built with a static frontend and a Cloudflare Worker API.

## Project layout

- `frontend/` — static HTML, CSS, and browser JavaScript deployed to GitHub Pages.
- `worker/` — the Cloudflare Worker API, including Google OAuth, sessions, and D1 queries.
- `schema/` — SQL used to initialize and seed the Cloudflare D1 database.
- [APIDOC.md](APIDOC.md) — Markdown HTTP endpoint reference for authentication, task, schedule, and admin APIs.
- [doc/index.html](doc/index.html) — Generated interactive API documentation.
- `.github/workflows/` — GitHub Actions workflows for frontend and Worker deployments.

## How it works

1. The frontend sends unauthenticated users to the Worker’s `/auth/google` route.
2. Google OAuth returns to `/auth/google/callback`; the Worker creates an encrypted session cookie.
3. Authenticated requests use that cookie to load the user’s tasks or schedule.
4. Admin-only routes allow authorized users to manage tasks and schedule sessions.

The Worker restricts CORS to `FRONTEND_URL`, and authorization is enforced by the Worker rather than the frontend.

## Local setup

### Prerequisites

- Node.js 20 or newer
- Wrangler (`npm install -g wrangler`)
- A Cloudflare account with a D1 database
- A Google OAuth client configured for the Worker callback URL

### Configure and initialize D1

From `worker/`, create the database and secrets:

```sh
wrangler d1 create task_portal
wrangler secret put SESSION_SECRET
wrangler secret put GOOGLE_CLIENT_SECRET
```

Update `worker/wrangler.toml` with the D1 database ID and frontend URL. Keep secrets out of source control.

For local development, initialize a local D1 copy:

```sh
wrangler d1 execute task_portal --local --file=../schema/001_init.sql
wrangler d1 execute task_portal --local --file=../schema/002_seed.sql
wrangler d1 execute task_portal --local --file=../schema/schedule_schema.sql
wrangler d1 execute task_portal --local --file=../schema/schedule_seed.sql
wrangler dev
```

For a database that already has the schedule tables, apply
`schema/003_schedule_unassigned_sessions.sql` once to allow plan tasks to be
created before assigning a person. Do not use `--remote` unless you intend to
modify production data.

### Preview the monthly summary without OAuth

From the repository root, run:

```sh
node frontend/dev-server.mjs
```

Open `http://127.0.0.1:4173/?demo=1` to view sample monthly summary data. The demo is limited to localhost and does not call the Worker or use live data; goal edits only affect in-memory sample data. The shared monthly goal is 170 points, with admin overrides scoped to an employee and month. Without `?demo=1`, the frontend follows the normal authentication flow.

## Deployment

- Changes under `frontend/` on `main` deploy automatically to GitHub Pages through `deploy.yml`.
- Changes under `worker/` on `main` deploy automatically with Wrangler through `deploy-worker.yml`.
- Worker deployment requires the GitHub `CLOUDFLARE_API_TOKEN` secret.

For a manual Worker deployment, run `wrangler deploy --config wrangler.toml` from `worker/` after checking the account, D1 binding, frontend URL, and secrets.

## Validation

There is no package manifest, build step, or linter. The monthly-summary aggregation tests use Node's built-in test runner. Before submitting changes:

- Run `node --experimental-default-type=module --test worker/tests/monthly-summary.test.mjs`.
- Run `node --check` on changed JavaScript files.
- Review API routes and database bindings manually.
- Smoke-test the localhost demo and, when available, authenticated behavior in a browser.
- Inspect `git diff` and ensure local Wrangler state and credentials are not included.
