-- Sample project
INSERT OR IGNORE INTO projects (project_code, project_name, description, status)
VALUES ('PRJ-001', 'Internal Tools', 'Internal tooling project', 'active');

-- Sample employee (admin)
INSERT OR IGNORE INTO employees
  (employee_code, first_name, last_name, email, department, role, skill_level, hourly_rate, is_admin)
VALUES
  ('EMP-001', 'Alice', 'Admin', 'alice@example.com', 'Engineering', 'Lead', 'expert', 75.00, 1),
  ('EMP-002', 'Bob',   'Dev',   'bob@example.com',   'Engineering', 'Developer', 'mid', 45.00, 0);

-- Sample task
INSERT OR IGNORE INTO tasks
  (task_code, title, description, project_id, priority, complexity, estimated_hours, required_skill, required_skill_level, status, deadline)
VALUES
  ('TSK-001', 'Set up CI/CD', 'Configure GitHub Actions for deployment',
   (SELECT project_id FROM projects WHERE project_code='PRJ-001'),
   'high', 'moderate', 8.0, 'DevOps', 'mid', 'assigned',
   datetime('now','+7 days'));

-- Assign task to Bob
INSERT OR IGNORE INTO task_assignments
  (employee_id, task_id, assigned_by, allocated_hours, status, completion_percentage)
VALUES
  ((SELECT employee_id FROM employees WHERE email='bob@example.com'),
   (SELECT task_id FROM tasks WHERE task_code='TSK-001'),
   (SELECT employee_id FROM employees WHERE email='alice@example.com'),
   8.0, 'assigned', 0);