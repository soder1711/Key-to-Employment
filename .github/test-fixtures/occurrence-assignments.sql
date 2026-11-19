PRAGMA foreign_keys = ON;

INSERT INTO employees (employee_id, employee_code, first_name, last_name, email)
VALUES (700, 'MIGRATE700', 'Migration', 'Employee', 'migration700@example.com');

UPDATE recurring_schedule_versions SET employee_id = 700 WHERE series_id = 3;

INSERT INTO schedule_sessions (
  session_id, session_date, program_id, employee_id, status, points,
  recurring_series_id, recurrence_date
) VALUES
  (60, '2026-11-19', 1, 700, 'scheduled', 2, NULL, NULL),
  (61, '2026-12-01', 1, 700, 'scheduled', 3, 3, '2026-12-01');

INSERT INTO recurring_schedule_exceptions (
  series_id, occurrence_date, action, program_id, employee_id, points
) VALUES (3, '2026-12-14', 'modified', 1, 700, 4);
