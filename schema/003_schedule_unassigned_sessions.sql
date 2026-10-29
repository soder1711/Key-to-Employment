-- One-time migration for existing databases created with schedule_schema.sql.
-- Rebuild the table so plan tasks can be created before a person is assigned.

CREATE TABLE schedule_sessions_new (
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
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id)  REFERENCES programs(program_id),
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id)
);

INSERT INTO schedule_sessions_new (
    session_id, session_date, program_id, employee_id, start_time, end_time,
    status, points, is_sudden, notes, created_by, created_at, updated_at
)
SELECT
    session_id, session_date, program_id, employee_id, start_time, end_time,
    status, points, is_sudden, notes, created_by, created_at, updated_at
FROM schedule_sessions;

DROP TABLE schedule_sessions;
ALTER TABLE schedule_sessions_new RENAME TO schedule_sessions;

CREATE INDEX idx_sessions_date ON schedule_sessions(session_date);
CREATE INDEX idx_sessions_employee_date
    ON schedule_sessions(employee_id, session_date);
CREATE INDEX idx_sessions_status ON schedule_sessions(status);

CREATE TRIGGER trg_sessions_updated
AFTER UPDATE ON schedule_sessions
FOR EACH ROW
BEGIN
    UPDATE schedule_sessions SET updated_at = CURRENT_TIMESTAMP
    WHERE session_id = NEW.session_id;
END;
