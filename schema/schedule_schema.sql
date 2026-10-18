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

-- Sessions: one occurrence of a program, one responsible staff member
CREATE TABLE IF NOT EXISTS schedule_sessions (
    session_id   INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date DATE NOT NULL,
    program_id   INTEGER NOT NULL,
    employee_id  INTEGER NOT NULL,
    start_time   TEXT,
    end_time     TEXT,
    status       TEXT NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled','completed','cancelled')),
    points       DECIMAL(5,2) NOT NULL DEFAULT 0 CHECK (points >= 0),
    is_sudden    INTEGER NOT NULL DEFAULT 0,
    notes        TEXT,
    created_by   INTEGER,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id)  REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON schedule_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_employee_date
    ON schedule_sessions(employee_id, session_date);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON schedule_sessions(status);

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