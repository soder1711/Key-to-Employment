-- Apply once after 007_legacy_weekly_copies_are_one_offs.sql.
-- Preserve assignments stored on concrete occurrences, then detach them from
-- the legacy single-assignee columns so recurring definitions stay unassigned.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schedule_occurrence_assignments (
    assignment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    recurring_series_id INTEGER,
    occurrence_date DATE,
    employee_id INTEGER NOT NULL,
    assigned_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES schedule_sessions(session_id) ON DELETE CASCADE,
    FOREIGN KEY (recurring_series_id) REFERENCES recurring_schedule_series(series_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (assigned_by) REFERENCES employees(employee_id),
    CHECK ((session_id IS NOT NULL AND recurring_series_id IS NULL AND occurrence_date IS NULL) OR
           (session_id IS NULL AND recurring_series_id IS NOT NULL AND occurrence_date IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_occurrence_assignment_session
    ON schedule_occurrence_assignments(session_id, employee_id)
    WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_occurrence_assignment_recurring
    ON schedule_occurrence_assignments(recurring_series_id, occurrence_date, employee_id)
    WHERE recurring_series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_occurrence_assignments_employee
    ON schedule_occurrence_assignments(employee_id);

INSERT INTO schedule_occurrence_assignments (session_id, employee_id, assigned_by, created_at)
SELECT session_id, employee_id, created_by, created_at
FROM schedule_sessions
WHERE recurring_series_id IS NULL AND employee_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO schedule_occurrence_assignments
    (recurring_series_id, occurrence_date, employee_id, assigned_by, created_at)
SELECT recurring_series_id, recurrence_date, employee_id, created_by, created_at
FROM schedule_sessions
WHERE recurring_series_id IS NOT NULL AND recurrence_date IS NOT NULL AND employee_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO schedule_occurrence_assignments
    (recurring_series_id, occurrence_date, employee_id, assigned_by, created_at)
SELECT series_id, occurrence_date, employee_id, created_by, created_at
FROM recurring_schedule_exceptions
WHERE action = 'modified' AND employee_id IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE schedule_sessions SET employee_id = NULL WHERE employee_id IS NOT NULL;
UPDATE recurring_schedule_versions SET employee_id = NULL WHERE employee_id IS NOT NULL;
UPDATE recurring_schedule_exceptions SET employee_id = NULL WHERE employee_id IS NOT NULL;
