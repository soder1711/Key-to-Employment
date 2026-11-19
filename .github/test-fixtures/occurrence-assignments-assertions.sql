CREATE TABLE migration_assertion (ok INTEGER NOT NULL CHECK (ok = 1));

INSERT INTO migration_assertion
SELECT CASE WHEN
  (SELECT COUNT(*) FROM schedule_occurrence_assignments
   WHERE session_id = 60 AND employee_id = 700) = 1
  AND
  (SELECT COUNT(*) FROM schedule_occurrence_assignments
   WHERE recurring_series_id = 3 AND occurrence_date = '2026-12-01'
     AND employee_id = 700) = 1
  AND
  (SELECT COUNT(*) FROM schedule_occurrence_assignments
   WHERE recurring_series_id = 3 AND occurrence_date = '2026-12-14'
     AND employee_id = 700) = 1
  AND
  (SELECT COUNT(*) FROM schedule_sessions
   WHERE session_id IN (60, 61) AND employee_id IS NULL) = 2
  AND
  (SELECT employee_id FROM recurring_schedule_versions WHERE series_id = 3) IS NULL
  AND
  (SELECT employee_id FROM recurring_schedule_exceptions
   WHERE series_id = 3 AND occurrence_date = '2026-12-14') IS NULL
THEN 1 ELSE 0 END;

DROP TABLE migration_assertion;
