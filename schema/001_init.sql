-- =====================================================
-- Cloudflare D1 Schema for Task Portal
-- D1 = SQLite, so MySQL-specific syntax must be adapted
-- =====================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------
-- Projects
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    project_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    project_code    TEXT UNIQUE NOT NULL,
    project_name    TEXT NOT NULL,
    description     TEXT,
    start_date      DATE,
    end_date        DATE,
    status          TEXT NOT NULL DEFAULT 'planning'
                    CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- -----------------------------------------------------
-- Employees
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
    employee_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_code       TEXT UNIQUE NOT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    cf_sub              TEXT UNIQUE,                    -- Google stable ID (added for self-OAuth)
    department          TEXT,
    role                TEXT,
    skill_level         TEXT NOT NULL DEFAULT 'mid'
                        CHECK (skill_level IN ('junior','mid','senior','expert')),
    hourly_rate         DECIMAL(10,2),
    max_hours_per_week  INTEGER NOT NULL DEFAULT 40,
    is_active           INTEGER NOT NULL DEFAULT 1,     -- 0/1 instead of BOOLEAN
    is_admin            INTEGER NOT NULL DEFAULT 0,     -- admin flag for whitelist
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_employees_email     ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_cf_sub    ON employees(cf_sub);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_active    ON employees(is_active);

-- -----------------------------------------------------
-- Tasks
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    task_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    task_code              TEXT UNIQUE NOT NULL,
    title                  TEXT NOT NULL,
    description            TEXT,
    project_id             INTEGER,
    priority               TEXT NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high','critical')),
    complexity             TEXT NOT NULL DEFAULT 'moderate'
                           CHECK (complexity IN ('simple','moderate','complex','very_complex')),
    estimated_hours        DECIMAL(8,2),
    required_skill         TEXT,
    required_skill_level   TEXT
                           CHECK (required_skill_level IN ('junior','mid','senior','expert')),
    status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
    deadline               DATETIME,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks(project_id);

-- -----------------------------------------------------
-- Task assignments (junction with time tracking)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS task_assignments (
    assignment_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id           INTEGER NOT NULL,
    task_id               INTEGER NOT NULL,
    assigned_by           INTEGER,
    assigned_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    start_date            DATETIME,
    end_date              DATETIME,
    allocated_hours       DECIMAL(8,2),
    actual_hours          DECIMAL(8,2) NOT NULL DEFAULT 0,
    status                TEXT NOT NULL DEFAULT 'assigned'
                          CHECK (status IN ('assigned','accepted','in_progress','paused','completed','cancelled')),
    completion_percentage DECIMAL(5,2) NOT NULL DEFAULT 0
                          CHECK (completion_percentage BETWEEN 0 AND 100),
    notes                 TEXT,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(employee_id),
    FOREIGN KEY (task_id)     REFERENCES tasks(task_id),
    FOREIGN KEY (assigned_by) REFERENCES employees(employee_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_employee ON task_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assignments_task     ON task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status   ON task_assignments(status);

-- Note: SQLite doesn't allow partial unique indexes across status with MySQL-style semantics,
-- but we can enforce one active assignment per (employee, task)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_assignment
    ON task_assignments(employee_id, task_id)
    WHERE status NOT IN ('cancelled','completed');

-- -----------------------------------------------------
-- Time entries
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS time_entries (
    entry_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    employee_id   INTEGER NOT NULL,
    task_id       INTEGER NOT NULL,
    entry_date    DATE NOT NULL,
    start_time    DATETIME,
    end_time      DATETIME,
    hours_worked  DECIMAL(5,2) NOT NULL,
    description   TEXT,
    billable      INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES task_assignments(assignment_id),
    FOREIGN KEY (employee_id)   REFERENCES employees(employee_id),
    FOREIGN KEY (task_id)       REFERENCES tasks(task_id)
);

CREATE INDEX IF NOT EXISTS idx_time_entries_date          ON time_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, entry_date);

-- -----------------------------------------------------
-- Triggers: emulate MySQL's ON UPDATE CURRENT_TIMESTAMP
-- -----------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_employees_updated
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    UPDATE employees SET updated_at = CURRENT_TIMESTAMP
    WHERE employee_id = NEW.employee_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated
AFTER UPDATE ON tasks
FOR EACH ROW
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP
    WHERE task_id = NEW.task_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_updated
AFTER UPDATE ON projects
FOR EACH ROW
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP
    WHERE project_id = NEW.project_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_assignments_updated
AFTER UPDATE ON task_assignments
FOR EACH ROW
BEGIN
    UPDATE task_assignments SET updated_at = CURRENT_TIMESTAMP
    WHERE assignment_id = NEW.assignment_id;
END;