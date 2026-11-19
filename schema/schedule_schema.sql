-- Apply with:
--   wrangler d1 execute task_portal --file=schedule_schema.sql --remote

PRAGMA foreign_keys = ON;

-- Programs: named work with category + credited point value
CREATE TABLE IF NOT EXISTS programs (
    program_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    code           TEXT UNIQUE NOT NULL,
    name           TEXT NOT NULL,
    category       TEXT NOT NULL DEFAULT 'general',
    default_points DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    default_start  TEXT,
    default_end    TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_programs_active ON programs(is_active);

-- Legacy weekly template tables remain for upgrading historical session links.
-- New recurring work uses versioned recurring_schedule_* records below.
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

-- Stable recurring series with effective-dated schedule versions.
CREATE TABLE IF NOT EXISTS recurring_schedule_series (
    series_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    legacy_template_id INTEGER UNIQUE,
    ended_from         DATE,
    created_by         INTEGER,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES employees(employee_id)
);
CREATE TABLE IF NOT EXISTS recurring_schedule_versions (
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
CREATE INDEX IF NOT EXISTS idx_recurring_versions_range
    ON recurring_schedule_versions(effective_from, effective_to, weekday);
CREATE INDEX IF NOT EXISTS idx_recurring_versions_series
    ON recurring_schedule_versions(series_id, effective_from);
CREATE TABLE IF NOT EXISTS recurring_schedule_exceptions (
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
-- Sessions: one occurrence of a program, optionally assigned to a staff member
CREATE TABLE IF NOT EXISTS schedule_sessions (
    session_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date DATE NOT NULL,
    program_id   INTEGER NOT NULL,
    employee_id  INTEGER,
    start_time   TEXT,
    end_time     TEXT,
    status       TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','completed','cancelled')),
    points       DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (points >= 0),
    is_sudden    INTEGER NOT NULL DEFAULT 0,
    notes        TEXT,
    created_by   INTEGER,
    template_id  INTEGER,
    template_date DATE,
    recurring_series_id INTEGER,
    recurrence_date DATE,
    occurrence_notes TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id)  REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (template_id) REFERENCES weekly_schedule_templates(template_id),
    FOREIGN KEY (recurring_series_id) REFERENCES recurring_schedule_series(series_id),
    CHECK ((template_id IS NULL AND template_date IS NULL) OR
           (template_id IS NOT NULL AND template_date IS NOT NULL)),
    CHECK ((recurring_series_id IS NULL AND recurrence_date IS NULL) OR
           (recurring_series_id IS NOT NULL AND recurrence_date IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON schedule_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_employee_date
    ON schedule_sessions(employee_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON schedule_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_session_date
    ON schedule_sessions(template_id, template_date);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_recurring_session_date
    ON schedule_sessions(recurring_series_id, recurrence_date);

-- Assignments belong to a dated occurrence, never to the recurring definition.
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

-- Tombstones prevent deleted generated occurrences from returning on later reads.
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

-- Append-only history: who changed what, when, old -> new in readable language
CREATE TABLE IF NOT EXISTS schedule_history (
    history_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    acted_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_email TEXT NOT NULL,
    action      TEXT NOT NULL,
    entity      TEXT NOT NULL,
    entity_id   INTEGER,
    details     TEXT
);
CREATE INDEX IF NOT EXISTS idx_history_time ON schedule_history(acted_at);

-- Enforce insert-only history at the storage level
CREATE TRIGGER IF NOT EXISTS trg_history_no_update
BEFORE UPDATE ON schedule_history
BEGIN
  SELECT RAISE(ABORT, 'schedule_history is append-only');
END;
CREATE TRIGGER IF NOT EXISTS trg_history_no_delete
BEFORE DELETE ON schedule_history
BEGIN
  SELECT RAISE(ABORT, 'schedule_history is append-only');
END;

-- Monthly credited-point target per staff member
CREATE TABLE IF NOT EXISTS monthly_targets (
    employee_id   INTEGER NOT NULL,
    year          INTEGER NOT NULL,
    month         INTEGER NOT NULL,
    target_points DECIMAL(6,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (employee_id, year, month),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

CREATE TRIGGER IF NOT EXISTS trg_sessions_updated
AFTER UPDATE ON schedule_sessions
FOR EACH ROW
BEGIN
    UPDATE schedule_sessions SET updated_at = CURRENT_TIMESTAMP
    WHERE session_id = NEW.session_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_weekly_templates_updated
AFTER UPDATE ON weekly_schedule_templates
FOR EACH ROW
BEGIN
    UPDATE weekly_schedule_templates SET updated_at = CURRENT_TIMESTAMP
    WHERE template_id = NEW.template_id;
END;