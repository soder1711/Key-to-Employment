-- Apply once after 005_weekly_schedule_templates.sql.
-- Existing template-backed sessions are kept as dated records and linked to
-- their recurring series; copied and manual sessions remain one-offs.

PRAGMA foreign_keys = ON;

CREATE TABLE recurring_schedule_series (
    series_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    legacy_template_id INTEGER UNIQUE,
    ended_from         DATE,
    created_by         INTEGER,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

CREATE TABLE recurring_schedule_versions (
    version_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id     INTEGER NOT NULL,
    weekday       INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    program_id    INTEGER NOT NULL,
    employee_id   INTEGER,
    start_time    TEXT,
    end_time      TEXT,
    points        DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (points >= 0),
    is_sudden     INTEGER NOT NULL DEFAULT 0,
    notes         TEXT,
    start_date    DATE NOT NULL,
    end_date      DATE,
    effective_from DATE NOT NULL,
    effective_to  DATE,
    created_by    INTEGER,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES recurring_schedule_series(series_id),
    FOREIGN KEY (program_id) REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (created_by) REFERENCES employees(employee_id),
    CHECK (end_date IS NULL OR end_date >= start_date),
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);
CREATE INDEX idx_recurring_versions_range
    ON recurring_schedule_versions(effective_from, effective_to, weekday);
CREATE INDEX idx_recurring_versions_series
    ON recurring_schedule_versions(series_id, effective_from);

CREATE TABLE recurring_schedule_exceptions (
    series_id    INTEGER NOT NULL,
    occurrence_date DATE NOT NULL,
    moved_date   DATE,
    action       TEXT NOT NULL CHECK (action IN ('cancelled', 'modified')),
    program_id   INTEGER,
    employee_id  INTEGER,
    start_time   TEXT,
    end_time     TEXT,
    points       DECIMAL(5,2),
    is_sudden    INTEGER,
    notes        TEXT,
    created_by   INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (series_id, occurrence_date),
    FOREIGN KEY (series_id) REFERENCES recurring_schedule_series(series_id),
    FOREIGN KEY (program_id) REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

ALTER TABLE schedule_sessions ADD COLUMN recurring_series_id INTEGER
    REFERENCES recurring_schedule_series(series_id);
ALTER TABLE schedule_sessions ADD COLUMN recurrence_date DATE;
ALTER TABLE schedule_sessions ADD COLUMN occurrence_notes TEXT;
CREATE UNIQUE INDEX uniq_recurring_session_date
    ON schedule_sessions(recurring_series_id, recurrence_date);

INSERT INTO recurring_schedule_series (series_id, legacy_template_id, created_by, created_at)
SELECT template_id, template_id, created_by, created_at
FROM weekly_schedule_templates;

INSERT INTO recurring_schedule_versions (
    series_id, weekday, program_id, employee_id, start_time, end_time,
    points, is_sudden, notes, start_date, end_date, effective_from, created_by
)
SELECT template_id, weekday, program_id, employee_id, start_time, end_time,
       points, is_sudden, notes, date('now'), NULL, date('now'), created_by
FROM weekly_schedule_templates
WHERE is_active = 1;

INSERT INTO recurring_schedule_exceptions
    (series_id, occurrence_date, action, created_by)
SELECT rs.series_id, old.session_date, 'cancelled', old.created_by
FROM weekly_schedule_exceptions old
JOIN recurring_schedule_series rs ON rs.legacy_template_id = old.template_id;

UPDATE schedule_sessions
SET recurring_series_id = (
      SELECT series_id FROM recurring_schedule_series rs
      WHERE rs.legacy_template_id = schedule_sessions.template_id
    ),
    recurrence_date = template_date
WHERE template_id IS NOT NULL AND template_date IS NOT NULL;
