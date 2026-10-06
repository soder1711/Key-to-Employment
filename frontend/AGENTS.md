# Frontend AI Agent Guide

## Structure

The frontend is currently a single static file: `index.html`. It is published as-is to GitHub Pages; there is no npm project, bundler, or frontend test harness.

## Implementation conventions

- Use standards-based HTML, CSS, and browser JavaScript that works without a build step.
- Keep API calls pointed at the configured Worker endpoint and preserve `credentials: 'include'` for session-cookie requests.
- The Worker owns authentication. The frontend should redirect to `/auth/google` for sign-in and `/auth/logout` for sign-out rather than implementing OAuth itself.
- Render user-controlled or API-provided text safely. Prefer `textContent` and DOM construction over interpolating untrusted values into `innerHTML`.
- Keep API response assumptions aligned with `worker/src/api.js`; currently `/api/me` returns the signed-in user and `/api/me/tasks` returns `{ tasks }`.
- Preserve the cross-origin cookie/CORS flow when changing requests. Test authenticated behavior in a browser because static-file and fetch behavior may differ from local assumptions.

## Validation

Use a browser smoke test for changes where possible:

1. Load the deployed or locally served `frontend/index.html`.
2. Confirm unauthenticated users see the Google sign-in action.
3. Confirm an authenticated user sees their email and tasks.
4. Confirm logout returns to the sign-in state.

For markup-only changes, inspect the resulting HTML and use a browser console/network tab to check failed requests. There is no repository-defined frontend test command.

## Deployment

Changes under `frontend/` on `main` trigger `.github/workflows/deploy.yml`, which uploads this directory directly to GitHub Pages. Do not add build-output assumptions to the workflow without updating that deployment process.