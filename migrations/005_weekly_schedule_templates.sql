-- Apply once to existing databases after 003_schedule_unassigned_sessions.sql.
-- The weekly timetable is expanded on schedule reads; no Cron Trigger is needed.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS weekly_schedule_templates (
    template_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    program_id   INTEGER NOT NULL,
    employee_id  INTEGER,
    start_time   TEXT,
    end_time     TEXT,
    points       DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (points >= 0),
    is_sudden    INTEGER NOT NULL DEFAULT 0,
    notes        TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_by   INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);
CREATE INDEX IF NOT EXISTS idx_weekly_templates_active_day
    ON weekly_schedule_templates(is_active, weekday);

ALTER TABLE schedule_sessions ADD COLUMN template_id INTEGER
    REFERENCES weekly_schedule_templates(template_id);
ALTER TABLE schedule_sessions ADD COLUMN template_date DATE;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_session_date
    ON schedule_sessions(template_id, template_date);

CREATE TABLE IF NOT EXISTS weekly_schedule_exceptions (
    template_id  INTEGER NOT NULL,
    session_date DATE NOT NULL,
    reason       TEXT NOT NULL DEFAULT 'deleted',
    created_by   INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (template_id, session_date),
    FOREIGN KEY (template_id) REFERENCES weekly_schedule_templates(template_id),
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);

CREATE TRIGGER IF NOT EXISTS trg_weekly_templates_updated
AFTER UPDATE ON weekly_schedule_templates
FOR EACH ROW
BEGIN
    UPDATE weekly_schedule_templates SET updated_at = CURRENT_TIMESTAMP
    WHERE template_id = NEW.template_id;
END;
