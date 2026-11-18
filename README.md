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

## Weekly timetable

The admin weekly timetable is the source of truth for recurring work. Admins can add recurring entries directly for a weekday, task type, assigned person, time, planned points, and explicit start and optional end dates. Importing a displayed week is also available as a setup shortcut; it imports one-off sessions and leaves existing recurring series alone.

Each recurring entry has a stable series ID. Schedule and monthly-summary reads expand the effective-dated series into dated occurrences without creating database session rows. “This and future occurrences” edits take an explicit cutoff date and preserve earlier versions and future one-off exceptions by default. Admins can explicitly replace exceptions, modify or move a single occurrence, cancel an occurrence, or end a series from a date onward. The “Weekly” and “Weekly - Modified” text badges identify recurring and overridden occurrences.

Session rows represent actual dated outcomes, such as completion, credited points, and occurrence-only notes. Completing a projected occurrence creates its session record; merely viewing a week does not. Existing copied/manual sessions remain one-offs, while records formerly linked to weekly templates retain their history during migration.

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
wrangler d1 execute task_portal --local --file=../schema/schedule_schema.sql
wrangler d1 execute task_portal --local --file=../schema/seeds/002_seed.sql
wrangler d1 execute task_portal --local --file=../schema/seeds/schedule_seed.sql
wrangler dev
```

`schema/` contains the current canonical schema for new databases; optional
sample data lives in `schema/seeds/`. The one-time upgrade scripts
for existing databases live in `migrations/`. Apply only migrations the target
database still needs, in numeric order, and never rerun a table-rebuild or
`ALTER TABLE` migration. In particular, apply migration `003` before `005` if
both are needed; apply migration `006_recurring_schedule_series.sql` after `005`
when upgrading an existing weekly-timetable database. The current canonical
schema already includes the changes from these migrations, so a fresh database
does not need them. Verify the target
database's existing schema before applying any migration, and do not use
`--remote` unless you intend to modify production data.

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
