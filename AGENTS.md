# AI Agent Guide

## Repository overview

Key-to-Employment is a small task portal with two independently deployed parts:

- `frontend/` is a static HTML frontend deployed to GitHub Pages.
- `worker/` is a vanilla JavaScript Cloudflare Worker backed by Cloudflare D1.
- `schema/` contains the canonical SQLite/D1 initialization and seed SQL.
- `.github/workflows/` contains the frontend and Worker deployment workflows.

There is currently no package manifest, build system, formatter, linter, or automated test suite in the repository. Do not introduce a framework or dependency unless the task explicitly requires it and the change is justified.

## General workflow

1. Read the scoped guide before changing files under `frontend/` or `worker/`.
2. Keep frontend, Worker, and schema changes coordinated. API or database changes should include corresponding client or migration updates when needed.
3. Preserve the existing JavaScript module style and the small, direct implementation approach.
4. Inspect `git diff` and `git status` before finishing. Do not include generated Wrangler state or local credentials.
5. Since there is no test runner, validate syntax and behavior with the narrowest available command and clearly report anything that could not be tested.

## Security and data handling

- Never commit secrets, OAuth credentials, session keys, access tokens, or contents of ignored files such as `worker/.env` and `schema/secret.sql`.
- Worker secrets belong in Cloudflare Wrangler secrets (`wrangler secret put ...`), not in source code or `worker/wrangler.toml`.
- Keep CORS restricted to the configured frontend origin.
- Treat all authenticated routes as authorization-sensitive. Database queries must remain parameterized and must scope records to the authenticated employee.
- Do not weaken OAuth state/PKCE validation or session-cookie security while making unrelated changes.

## Validation and deployment

Frontend deployment is handled automatically by `.github/workflows/deploy.yml` when `main` changes under `frontend/`. It uploads `frontend/` as a static GitHub Pages artifact.

Worker deployment is handled by `.github/workflows/deploy-worker.yml` when `main` changes under `worker/`. The workflow uses Node 20 and Wrangler with the `CLOUDFLARE_API_TOKEN` GitHub secret.

For database/deployment operations, review `worker/install.sh` and `worker/wrangler.toml` first. Commands that target D1 with `--remote`, create databases, set secrets, or deploy must not be run casually against production.

## Change reporting

In the final report, summarize changed files, validation commands and results, and any manual browser/OAuth/D1 testing that remains necessary.