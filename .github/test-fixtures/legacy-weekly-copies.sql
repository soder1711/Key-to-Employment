PRAGMA foreign_keys = ON;

INSERT INTO programs (program_id, code, name, category)
VALUES (1, 'TEST', 'Migration test', 'general');

INSERT INTO weekly_schedule_templates (template_id, weekday, program_id, is_active)
VALUES (100, 3, 1, 1), (200, 3, 1, 0);

INSERT INTO recurring_schedule_series (series_id, legacy_template_id)
VALUES (1, 100), (2, 200), (3, NULL);

INSERT INTO recurring_schedule_versions (
  series_id, weekday, program_id, start_date, effective_from
) VALUES
  (1, 3, 1, '2026-11-18', '2026-11-18'),
  (3, 3, 1, '2026-11-01', '2026-11-01');

INSERT INTO schedule_sessions (
  session_id, session_date, program_id, status, template_id, template_date,
  recurring_series_id, recurrence_date
) VALUES
  (1, '2026-11-17', 1, 'completed', 100, '2026-11-17', 1, '2026-11-17'),
  (2, '2026-11-18', 1, 'scheduled', 100, '2026-11-18', 1, '2026-11-18'),
  (3, '2026-11-25', 1, 'scheduled', 100, '2026-11-25', 1, '2026-11-25'),
  (4, '2026-11-17', 1, 'completed', 200, '2026-11-17', 2, '2026-11-17'),
  (5, '2026-11-17', 1, 'completed', NULL, NULL, 3, '2026-11-17');
