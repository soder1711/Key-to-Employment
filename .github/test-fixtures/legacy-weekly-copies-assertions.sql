CREATE TABLE migration_assertion (ok INTEGER NOT NULL CHECK (ok = 1));

INSERT INTO migration_assertion
SELECT CASE WHEN
  (SELECT COUNT(*) FROM schedule_sessions
   WHERE session_id IN (1, 4)
     AND recurring_series_id IS NULL AND recurrence_date IS NULL) = 2
  AND
  (SELECT COUNT(*) FROM schedule_sessions
   WHERE session_id IN (2, 3)
     AND recurring_series_id = 1 AND recurrence_date IS NOT NULL) = 2
  AND
  (SELECT COUNT(*) FROM schedule_sessions
   WHERE session_id = 5 AND recurring_series_id = 3
     AND recurrence_date = '2026-11-17') = 1
  AND
  (SELECT status FROM schedule_sessions WHERE session_id = 1) = 'completed'
THEN 1 ELSE 0 END;

DROP TABLE migration_assertion;
