# Monthly Summary View Plan

## Goal

Add an admin-facing monthly summary that compares each active employee's completed work and points with their monthly goal, including a breakdown by each 10-day interval.

## Proposed view

- Add an admin-only **Monthly summary** navigation item and view.
- Include month navigation (previous, current, next) and a clear month/year heading.
- Show one row per active employee with:
  - Completed points for days 1–10, 11–20, and 21–month-end.
  - Total completed points for the month.
  - The shared 170-point monthly goal by default, with per-person, per-month overrides that admins can save or reset.
  - Points above goal and signed goal variance, so both exceeded and unmet goals are clear.
  - Number of completed tasks/sessions.
- Include loading, error, empty-state, and narrow-screen behavior.
- Add English and Vietnamese labels, matching the existing frontend conventions.

## Data and API

The Worker already exposes the admin-protected `GET /api/admin/schedule/monthly` route. Its response includes employee identity, completed points, completed sessions, and monthly targets.

Extend this endpoint to provide per-interval completed points and completed-task counts. Use the session date and `status = 'completed'` for the breakdown. Use 170 points as the shared goal when no employee-month override exists; allow admins to save or reset an override with the existing target endpoint. Preserve the admin authorization check, parameterized database queries, and existing response fields. Do not count scheduled or cancelled sessions as completed work.

## Frontend implementation

1. Add the summary navigation control and section to `frontend/index.html`.
2. Add month selection, API loading, display formatting, and safe DOM rendering to `frontend/app.js`.
3. Add responsive table and summary styles to `frontend/styles.css`.
4. Keep the view hidden from non-admin users in the normal authenticated application flow.

## Tests

Use Node's built-in `node:test` without adding a dependency. Run `node --experimental-default-type=module --test worker/tests/monthly-summary.test.mjs`. Cover the summary calculation or response mapping for:

- Interval boundaries (days 1, 10, 11, 20, 21, and the month's final day).
- Completed versus scheduled/cancelled sessions.
- Total points, completed-task counts, goal variance, and points exceeded.
- Empty results and months with different lengths.

Also run `node --check` on changed JavaScript files. There is no existing test harness, so keep any test setup minimal and document the command to run it.

## Unauthenticated local preview

Provide an explicitly labeled demo mode backed by fixture data so the view can be previewed without OAuth or live D1 data. Enable it only on localhost, and keep it separate from real API/auth flows. It must not weaken Worker authentication or admin checks and must not be enabled in production. Start the static preview with `node frontend/dev-server.mjs` and open `http://127.0.0.1:4173/?demo=1`. Verify normal production behavior still requires authentication.

## Validation

- Run focused Node tests and syntax checks.
- Browser-smoke-test the localhost demo with multiple employees, including empty and below/above-goal cases.
- Test authenticated admin access against the real Worker when credentials and a suitable test environment are available; verify non-admin and unauthenticated API requests remain denied.
- Check the responsive layout and both language options.
