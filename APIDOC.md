# Task Portal API

The API is served by the Cloudflare Worker. The deployed frontend uses:

```text
https://task-portal.soder1234.workers.dev
```

Use the Worker URL configured for the environment instead of hard-coding this value in new clients.

## Authentication

Sign in through Google OAuth:

```http
GET /auth/google
```

The Worker redirects to Google and then back to `/auth/google/callback`. On success it sets an encrypted `session` cookie and redirects to `FRONTEND_URL`.

```http
GET /auth/logout
```

Clears the session cookie and redirects to `FRONTEND_URL`.

All `/api/*` routes require the session cookie. Browser clients must send credentials, for example:

```js
fetch(`${WORKER}/api/me`, { credentials: 'include' });
```

Unauthenticated requests return `401 Unauthorized`. Admin routes return `403 Forbidden` when the signed-in user is not an administrator.

## Common behavior

- API responses are JSON on successful requests.
- `POST` request bodies must use `Content-Type: application/json`.
- CORS allows only the configured `FRONTEND_URL` origin and supports credentials.
- Dates use `YYYY-MM-DD`.
- Times use `HH:MM`.
- Progress and points are numeric values; progress is limited to `0–100`.

## Current-user endpoints

### Get current user

```http
GET /api/me
```

Response:

```json
{
  "email": "bob@example.com",
  "employeeId": 2,
  "isAdmin": false
}
```

### List my tasks

```http
GET /api/me/tasks
```

Response:

```json
{ "tasks": [/* task assignment records */] }
```

### Get one of my tasks

```http
GET /api/tasks/{taskId}
```

Returns `{ "task": { ... } }`. The task must belong to the authenticated employee. Returns `404` if it does not exist or is not assigned to the user.

### Update my task progress

```http
POST /api/progress
Content-Type: application/json
```

Request:

```json
{
  "assignmentId": 12,
  "percentage": 50,
  "notes": "Implementation is in review"
}
```

Response:

```json
{ "success": true }
```

The assignment is updated only when it belongs to the authenticated employee. Invalid percentages return `400`; an unknown or unauthorized assignment returns `404`.

## Schedule endpoints

### Get my weekly schedule

```http
GET /api/schedule?start=2026-10-19
```

`start` is optional. The Worker normalizes it to the Monday of the requested week. Recurring timetable entries are projected into the requested range; reading a schedule does not create session rows. `year` and `month` are optional and control the monthly progress summary. Completed recurring occurrences are stored as dated sessions; planned future occurrences are not. Each session has an `assignees` array; empty means unassigned. The occurrence is returned once regardless of assignee count.

Response:

```json
{
  "weekStart": "2026-10-19",
  "dates": ["2026-10-19", "...", "2026-10-25"],
  "sessions": [/* schedule session records */],
  "summary": { "...": "monthly summary" },
  "summaryMonth": { "year": 2026, "month": 10 }
}
```

Projected occurrences include `is_recurring: true`, `is_projected: true`, `recurring_series_id`, and `recurrence_date`. A session-backed occurrence has `is_projected: false` and a numeric `session_id`. An occurrence override has `is_modified: true`.

## Admin endpoints

Admin endpoints require `isAdmin: true` in the authenticated session.

### List tasks

```http
GET /api/admin/tasks?status=in_progress&employeeId=2
```

Both query parameters are optional. Returns `{ "tasks": [ ... ] }`.

### Get any task

```http
GET /api/admin/tasks/{taskId}
```

Returns `{ "task": { ... } }`, or `404` when the task does not exist.

### Update any task assignment

```http
POST /api/admin/progress
Content-Type: application/json
```

Request:

```json
{
  "assignmentId": 12,
  "percentage": 100,
  "notes": "Completed"
}
```

Response: `{ "success": true }`.

### Get the admin weekly schedule

```http
GET /api/admin/schedule?start=2026-10-19
```

Response:

```json
{
  "weekStart": "2026-10-19",
  "dates": ["2026-10-19", "...", "2026-10-25"],
  "sessions": [/* all schedule sessions */],
  "employees": [/* active employees */],
  "programs": [/* available programs */],
  "weeklyTimetableEnabled": true
}
```

Recurring occurrences are projected for the requested week, without creating session rows. Existing copied/manual sessions remain one-offs.

### List recurring timetable entries

```http
GET /api/admin/schedule/timetable
```

Returns `{ "entries": [ ... ] }` with the open effective version for each series, including its stable `series_id`, weekday, task, planned points, start date, and optional end date. Recurring definitions have no default assignee; assign employees to dated occurrences instead.

### Create or edit a recurring entry

```http
POST /api/admin/schedule/timetable
Content-Type: application/json
```

Create an entry directly:

```json
{
  "operation": "create",
  "weekday": 1,
  "programId": 1,
  "employeeId": null,
  "startTime": "09:00",
  "endTime": "10:00",
  "points": 2.5,
  "isSudden": false,
  "startDate": "2026-11-16",
  "endDate": null,
  "notes": null
}
```

New recurring definitions are unassigned. `weekday` uses JavaScript numbering (Sunday `0` through Saturday `6`). An edit creates a new effective-dated version from the explicit cutoff and preserves prior settings:

```json
{
  "operation": "edit",
  "seriesId": 12,
  "cutoffDate": "2026-11-23",
  "weekday": 1,
  "programId": 1,
  "employeeId": null,
  "startTime": "10:00",
  "endTime": "11:00",
  "points": 2.5,
  "isSudden": false,
  "notes": null,
  "replaceFutureExceptions": false
}
```

Future occurrence exceptions are preserved unless `replaceFutureExceptions` is explicitly `true`. The update and its schedule-history record are applied atomically. Existing completed sessions retain their recorded values.

### Modify or cancel one occurrence; end a series

Use the same `POST /api/admin/schedule/timetable` route with an `operation` of `exception` to store an occurrence override (`action: "modify"`) or cancellation (`action: "cancel"`). Modified exceptions may set `movedDate`, task, times, points, and notes; they appear with `is_modified: true`. Assignments are changed separately using the occurrence-assignment endpoint. Completion and occurrence notes remain on the dated session, not in the recurring definition. Completed occurrences cannot be moved, modified, or cancelled.

To stop one recurring series from a date onward, send `{ "operation": "end", "seriesId": 12, "cutoffDate": "2026-11-23" }`. Earlier versions and completed session records are retained. Ending the whole timetable uses the legacy endpoint below with `enabled: false` and an explicit `cutoffDate`.

### Import a week or stop all weekly entries

```http
POST /api/admin/schedule/weekly-timetable
Content-Type: application/json
```

As an optional setup shortcut, import the selected week's non-recurring sessions as recurring entries:

```json
{ "enabled": true, "weekStart": "2026-10-19" }
```

Existing recurring entries are kept; imported entries start on the selected week's Monday.

To stop future generation while keeping already-created sessions:

```json
{ "enabled": false, "cutoffDate": "2026-11-17" }
```

The stop operation applies from `cutoffDate` onward. Earlier timetable versions and completed session records are retained.

### Assign a schedule session

```http
POST /api/admin/schedule/assign
Content-Type: application/json
```

Request:

```json
{
  "employeeId": 2,
  "date": "2026-10-21",
  "programId": 1,
  "startTime": "09:00",
  "endTime": "10:00",
  "points": 2.5,
  "isSudden": false,
  "notes": "Optional note"
}
```

Response: `{ "success": true, "session": { ... } }`.

`programId` and `date` are required. `employeeId` is optional; when provided, it creates an occurrence assignment link. Times are optional. Points must be between `0` and `100`. `repeatWeeks` optionally creates independent one-off sessions on the same weekday (maximum 53 weeks); omit it or use `1` for only this date. Ongoing repetition uses a recurring timetable series.

### Add or remove an occurrence assignee

```http
POST /api/admin/schedule/reassign
Content-Type: application/json
```

Add an employee to, or remove them from, one dated occurrence. Use either a one-off `sessionId` or the recurring `seriesId` and `occurrenceDate`:

```json
{ "seriesId": 12, "occurrenceDate": "2026-11-17", "employeeId": 2, "assigned": true }
```

Set `assigned` to `false` to remove the employee. It defaults to `true`. Multiple employees may be linked to one occurrence; duplicate links are ignored. This never changes the recurring definition or another date. Completion and status remain shared by the occurrence.

### Edit a schedule session

```http
POST /api/admin/schedule/update
Content-Type: application/json
```

Request fields: `sessionId`, `programId`, `sessionDate`, `points`, and `isSudden`; `startTime`, `endTime`, and `notes` are optional. This updates only a one-off session and preserves its assignee and status. Use the recurring timetable endpoint to edit a recurring occurrence or series.

Response: `{ "success": true, "session": { ... } }`.

### Clone a session to other weekdays

```http
POST /api/admin/schedule/clone
Content-Type: application/json
```

Request: `{ "sessionId": 42, "dates": ["2026-10-22", "2026-10-23"] }`.
Dates must be distinct weekdays in the same Monday-Sunday week as the source session, excluding its date. The clone copies the task settings and assignee and starts in `scheduled` status.

Response: `{ "success": true, "clonedCount": 2, "sessions": [ ... ] }`.

### Copy a weekly schedule to the next week

```http
POST /api/admin/schedule/copy-week
Content-Type: application/json
```

Request: `{ "weekStart": "2026-10-19" }`, where `weekStart` is a Monday. Copies non-cancelled sessions to the corresponding dates one week later, keeps task settings and assignees, and resets copied sessions to `scheduled`. Matching sessions already present next week are not duplicated; no future recurrence is created.

Response: `{ "success": true, "sourceWeekStart": "2026-10-19", "targetWeekStart": "2026-10-26", "createdCount": 5, "skippedCount": 2 }`.

### Change session status

```http
POST /api/admin/schedule/status
Content-Type: application/json
```

Request for a session-backed occurrence:

```json
{ "sessionId": 42, "status": "completed" }
```

Allowed statuses are `scheduled`, `completed`, and `cancelled`. Response: `{ "success": true }`.
For a projected recurring occurrence, send `{ "seriesId": 12, "occurrenceDate": "2026-11-17", "displayDate": "2026-11-17", "status": "completed", "occurrenceNotes": "Finished" }`; this creates the dated session record. Reading the schedule alone never does.

### Delete a schedule session

```http
POST /api/admin/schedule/delete
Content-Type: application/json
```

Request: `{ "sessionId": 42 }` for a session-backed occurrence, or `{ "seriesId": 12, "occurrenceDate": "2026-11-17", "displayDate": "2026-11-17" }` for a projected occurrence. Removing a planned recurrence is stored as an occurrence cancellation; completed records cannot be deleted.

Response: `{ "success": true }`.

### Get monthly schedule summary

```http
GET /api/admin/schedule/monthly?year=2026&month=10
```

`year` and `month` default to the current UTC year and month. The admin-only response is `{ "year": 2026, "month": 10, "rows": [ ... ] }`. Projected recurring occurrences contribute estimated points without creating session rows; completed points and counts come from dated session records. Each assigned employee receives the full points for a completed occurrence. `estimated_points` sums all assigned, non-cancelled sessions assuming completion and is separate from `completed_points`. Each row also includes points and completed-session counts for days 1–10, 11–20, and 21–month-end, plus target status and goal variance. The shared default goal is 170 points; `target_is_override` indicates whether that employee has a month-specific override:

```json
{
  "employee_id": 2,
  "first_name": "Example",
  "last_name": "Employee",
  "completed_points": 28,
  "estimated_points": 40,
  "completed_sessions": 12,
  "target_points": 24,
  "target_set": true,
  "target_is_override": true,
  "days_1_10_points": 12.5,
  "days_1_10_completed_sessions": 5,
  "days_11_20_points": 9.5,
  "days_11_20_completed_sessions": 4,
  "days_21_end_points": 6,
  "days_21_end_completed_sessions": 3,
  "goal_variance": 4,
  "points_above_goal": 4
}
```

Without an override, rows use the shared 170-point goal and set `target_is_override` to `false`. `goal_variance` is completed points minus the effective goal; `points_above_goal` is zero when below goal.

### Set an employee's monthly target

```http
POST /api/admin/schedule/target
Content-Type: application/json
```

Request:

```json
{
  "employeeId": 2,
  "year": 2026,
  "month": 10,
  "targetPoints": 40
}
```

Target points must be between `0` and `10000`. The override applies to that employee and month. To clear an override and use the shared 170-point goal, send `{ "employeeId": 2, "year": 2026, "month": 10, "useDefault": true }`. Response: `{ "success": true, "usingDefault": false }` when saving a value or `true` when resetting.

## Error responses

Errors may be returned as plain text for validation and not-found cases, or as JSON for authentication and authorization failures:

```json
{ "error": "Unauthorized" }
```

Common status codes:

| Status | Meaning |
| --- | --- |
| `204` | CORS preflight completed |
| `302` | OAuth or logout redirect |
| `400` | Invalid request body or query parameter |
| `401` | Missing, expired, or invalid session |
| `403` | Authenticated user lacks admin access |
| `404` | Resource not found or not owned by the user |
| `500` | Unexpected Worker or database error |
