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

The admin weekly timetable is the source of truth for recurring work. Admins can add recurring entries directly for a weekday, task type, time, planned points, and explicit start and optional end dates. Rules define fixed occurrences and have no default assignee. Importing a displayed week is also available as a setup shortcut; it imports one-off sessions and leaves existing recurring series alone.

Each recurring entry has a stable series ID. Schedule and monthly-summary reads expand the effective-dated series into dated occurrences without creating database session rows. “This and future occurrences” edits take an explicit cutoff date and preserve earlier versions and future one-off exceptions by default. Admins can explicitly replace exceptions, modify or move a single occurrence, cancel an occurrence, or end a series from a date onward. The “Weekly” and “Weekly - Modified” text badges identify recurring and overridden occurrences.

Session rows represent one actual dated occurrence, including its shared status, credited points, and occurrence-only notes. Employee assignments are separate links to that occurrence: no links means unassigned, and multiple links allow multiple employees without duplicating the task/session. Each assignee receives the full session points when it is completed. Estimated points assume all assigned sessions are completed and are shown separately from points earned. Completing a projected occurrence creates its session record; merely viewing a week does not. Copied/manual sessions remain one-offs. When upgrading legacy weekly templates, dated copies before the migrated rule's effective date stay one-offs; only occurrences linked to the active rule are marked weekly.

### Finding and using the timetable

- Admins: **Schedule** opens the selected week's **Weekly timetable** assignment matrix, with recurring definitions editable from each task slot; **Plan** opens dated sessions for all seven days of the selected week. Employees retain their personal dated schedule.
- **Weekly timetable** shows the selected week's fixed recurring task occurrences as weekday-grouped columns and employees as rows. Each occurrence column shows its task, time, points, and per-employee assignment status; the unassigned row identifies occurrences with no assignees. Click a task to edit its recurring definition or **Add recurring entry** to create one. This is a dated assignment preview, not a historical timetable editor.
- **Plan** retains the dated-sessions view: each day's fixed tasks are the timetable occurrences returned for that date, alongside one-off sessions. Assignees come from the occurrence assignment links. Dragging a person onto a task adds them for that date; dragging them onto it again removes them. Multiple people can share one occurrence. Assignment changes never affect the recurring definition or another date. Completion remains shared on the occurrence. Existing future exceptions are preserved unless explicitly replaced. Cancelling a recurring-rule change makes no change.
- **Monthly summary** compares each employee's completed points with their monthly goal. Click an employee or monthly points total to inspect the dated sessions that make up the month.
- **Quarterly report** lets admins select an employee, year, and quarter to compare each month's credited points and target, with totals for the quarter. Click a month's points or the quarter total to trace it to sessions.
- **History** supports staff, record, and inclusive date-range filters, numbered pages, and previous/next navigation.
- Schedule and planning views display the schedule timezone (`Asia/Ho_Chi_Minh`, UTC+07:00). An end time earlier than a start time denotes an overnight session ending the following day.
- Programme defaults can be edited without rewriting stored session points or times. Admin session details expose the hide/delete action for the selected date.
- **Dated schedule** is for completion, actual notes, and exceptions. Clicking an empty cell adds a one-off session. **Import and copy tools** contains the optional setup shortcuts; finite repeat copies remain separate one-off sessions.
- Saving recurring edits opens a change dialog with a before/after summary. Choose **This and future occurrences** (default) with an effective date, or **Only this occurrence** when editing a dated task. Use **Go to** to pick a date; Plan also offers **Today** and **This week** shortcuts.
- End an individual series from its timetable rule or task details. **Series management** contains **Stop weekly timetable**, which ends all recurring entries from a selected date without affecting one-offs. Completion and actual notes remain occurrence-only.

For a browser smoke test with an authenticated admin, confirm Schedule groups this week's recurring task slots by weekday, shows employees and occurrence assignments, and Plan opens all seven dated days. Assign two employees to one recurring occurrence from Plan, remove one, and verify other weeks remain unchanged. Complete the occurrence and confirm both assigned employees receive its full points; estimated points should remain distinct from actual points earned. Then edit a recurring rule from Schedule and verify its effective date. Check the same task as an employee and confirm timetable controls are absent. Also check the Vietnamese labels and the horizontally scrollable grids on mobile. The localhost monthly-summary demo below does not preview the timetable.

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
when upgrading an existing weekly-timetable database, then apply
`007_legacy_weekly_copies_are_one_offs.sql` to correct legacy copied sessions,
followed by `008_occurrence_assignments.sql` to move existing dated assignments to
occurrence links. It preserves assignments on stored sessions and modified exceptions;
recurring definitions become unassigned.
The current canonical schema already includes the changes from these
migrations, so a fresh database does not need them. Verify the target database's
existing schema before applying any migration, and do not use `--remote` unless
you intend to modify production data.

### Preview workload reports without OAuth

From the repository root, run:

```sh
node frontend/dev-server.mjs
```

Open `http://127.0.0.1:4173/?demo=1` to view sample monthly and quarterly report data. Click a monthly or quarterly points total to open its session list. The demo is limited to localhost and does not call the Worker or use live data; goal edits only affect in-memory sample data. The shared monthly goal is 170 points, with admin overrides scoped to an employee and month. Without `?demo=1`, the frontend follows the normal authentication flow.

## Deployment

- Changes under `frontend/` on `main` deploy automatically to GitHub Pages through `deploy.yml`.
- Changes under `worker/` on `main` deploy automatically with Wrangler through `deploy-worker.yml`.
- Worker deployment requires the GitHub `CLOUDFLARE_API_TOKEN` secret.

For a manual Worker deployment, run `wrangler deploy --config wrangler.toml` from `worker/` after checking the account, D1 binding, frontend URL, and secrets.

## Validation

There is no package manifest, build step, or linter. The monthly-summary aggregation tests use Node's built-in test runner. Before submitting changes:

- Run `node --experimental-default-type=module --test worker/tests/monthly-summary.test.mjs`.
- Run `node --experimental-default-type=module --test worker/tests/report-management.test.mjs` for quarterly reports, programme edits, and overnight-session validation.
- Run `node --experimental-default-type=module --test worker/tests/recurrence.test.mjs worker/tests/schedule-edits.test.mjs worker/tests/occurrence-assignments.test.mjs` for recurrence and assignment regressions.
- Worker CI initializes an isolated Wrangler local D1, verifies legacy migration 007, then applies migration 008 and asserts that stored session and exception assignments are preserved as occurrence links. The Worker deployment waits for these tests to pass.
- Run `node --test frontend/tests/timetable.test.mjs` for timetable grouping, mode gating, and change-dialog behavior.
- Run `node --check` on changed JavaScript files.
- Review API routes and database bindings manually.
- Smoke-test the localhost demo and, when available, authenticated behavior in a browser.
- Inspect `git diff` and ensure local Wrangler state and credentials are not included.
