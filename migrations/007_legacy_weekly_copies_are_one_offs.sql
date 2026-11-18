-- Apply once after 006_recurring_schedule_series.sql.
-- Sessions copied from legacy weekly templates before their migrated rule's
-- effective date are dated records, not occurrences of the new recurring rule.
-- Inactive legacy templates have no migrated versions, so all their copies are
-- one-offs. Keep current/future sessions linked to active migrated rules.

UPDATE schedule_sessions
SET recurring_series_id = NULL,
    recurrence_date = NULL
WHERE recurring_series_id IN (
    SELECT series_id
    FROM recurring_schedule_series
    WHERE legacy_template_id IS NOT NULL
)
AND (
    NOT EXISTS (
        SELECT 1
        FROM recurring_schedule_versions v
        WHERE v.series_id = schedule_sessions.recurring_series_id
    )
    OR recurrence_date < (
        SELECT MIN(v.effective_from)
        FROM recurring_schedule_versions v
        WHERE v.series_id = schedule_sessions.recurring_series_id
    )
);
