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

`start` is optional. The Worker normalizes it to the Monday of the requested week. `year` and `month` are optional and control the monthly progress summary.

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
  "programs": [/* available programs */]
}
```

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

`employeeId`, `programId`, and `date` are required. Times are optional. Points must be between `0` and `100`.

### Change session status

```http
POST /api/admin/schedule/status
Content-Type: application/json
```

Request:

```json
{ "sessionId": 42, "status": "completed" }
```

Allowed statuses are `scheduled`, `completed`, and `cancelled`. Response: `{ "success": true }`.

### Delete a schedule session

```http
POST /api/admin/schedule/delete
Content-Type: application/json
```

Request: `{ "sessionId": 42 }`

Response: `{ "success": true }`.

### Get monthly schedule summary

```http
GET /api/admin/schedule/monthly?year=2026&month=10
```

`year` and `month` default to the current UTC year and month. Response: `{ "year": 2026, "month": 10, "rows": [ ... ] }`.

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

Target points must be between `0` and `10000`. Response: `{ "success": true }`.

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
