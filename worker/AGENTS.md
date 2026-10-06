# Worker AI Agent Guide

## Structure and runtime

This directory contains a vanilla ES-module Cloudflare Worker:

- `src/index.js` routes requests and attaches CORS headers.
- `src/auth.js` implements Google OAuth with state and PKCE.
- `src/session.js` encrypts and parses session cookies with the Web Crypto API.
- `src/api.js` validates API inputs and delegates to database functions.
- `src/db.js` contains parameterized D1 queries.
- `wrangler.toml` defines the Worker and its D1 binding.

The Worker has no checked-in `package.json` or dependency installation step. Use APIs available in the Cloudflare Workers runtime unless a dependency is deliberately added and its deployment impact is documented.

## Routing and authorization

Public routes are `/auth/google`, `/auth/google/callback`, and `/auth/logout`. Other routes require a valid `session` cookie. When adding a protected route:

1. Keep authentication in the central flow in `src/index.js`.
2. Validate method, path parameters, request bodies, and numeric ranges.
3. Enforce ownership in the SQL `WHERE` clause using `session.employeeId`; never rely only on a client-provided employee or assignment ID.
4. Return consistent JSON/error responses and preserve CORS headers.

## Database conventions

- Cloudflare D1 uses SQLite syntax. The canonical schema is `/Users/quynh/Key-to-Employment/schema/001_init.sql`; seed data is in `schema/002_seed.sql`.
- Use `?` placeholders and `.bind(...)` for every user-controlled value. Never concatenate request data into SQL.
- Update the canonical schema files for schema changes, and consider whether existing remote databases need a safe migration rather than rerunning initialization SQL.
- Keep foreign keys, status constraints, and indexes consistent with the existing schema.

## Security rules

- Do not put `SESSION_SECRET` or `GOOGLE_CLIENT_SECRET` in source, `wrangler.toml`, or committed documentation examples containing real values.
- Preserve OAuth state checking, PKCE, encrypted cookies, expiration checks, `HttpOnly`, `Secure`, and cross-site cookie behavior unless a security-focused change explicitly requires otherwise.
- Keep `FRONTEND_URL` as the only allowed CORS origin.
- Avoid logging access tokens, cookies, OAuth codes, or personal data.

## Validation and deployment

There is no automated test suite. Before finishing Worker changes:

- Run a syntax check for changed JavaScript files where supported by the installed Node version, for example `node --check src/index.js` from this directory.
- Review routes, status codes, SQL bindings, and error paths manually.
- Use Wrangler local development only when local bindings/secrets are configured; do not assume production D1 data is safe to modify.

Production deployment is performed from the repository workflow using Wrangler and `CLOUDFLARE_API_TOKEN`. Review `wrangler.toml` and `.github/workflows/deploy-worker.yml` before changing deployment behavior.