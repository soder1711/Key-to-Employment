export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;
export const MAX_CORRECTION_REASON_LENGTH = 1000;
export const MAX_REPEAT_WEEKS = 53;

export function parseCorrectionReason(body) {
  if (body?.correctionReason === undefined || body.correctionReason === null) return undefined;
  if (typeof body.correctionReason !== 'string') return null;
  const reason = body.correctionReason.trim();
  if (!reason) return undefined;
  return reason.length <= MAX_CORRECTION_REASON_LENGTH ? reason : null;
}

export function isValidISODate(value) {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addDaysISO(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
