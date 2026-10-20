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
wrangler dev
```

Do not use `--remote` unless you intend to modify production data.

## Deployment

- Changes under `frontend/` on `main` deploy automatically to GitHub Pages through `deploy.yml`.
- Changes under `worker/` on `main` deploy automatically with Wrangler through `deploy-worker.yml`.
- Worker deployment requires the GitHub `CLOUDFLARE_API_TOKEN` secret.

For a manual Worker deployment, run `wrangler deploy` from `worker/` after checking the account, D1 binding, frontend URL, and secrets.

## Validation

There is no package manifest, build step, linter, or automated test suite. Before submitting changes:

- Run `node --check src/index.js` (and repeat for changed Worker JavaScript files) from `worker/`.
- Review API routes and database bindings manually.
- Smoke-test sign-in, task loading, schedule views, and logout in a browser when those areas change.
- Inspect `git diff` and ensure local Wrangler state and credentials are not included.
