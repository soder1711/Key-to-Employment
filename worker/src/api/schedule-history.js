import {
  getScheduleHistory
} from '../db.js';
import { isValidISODate } from './schedule-validation.js';

export async function handleGetScheduleHistory(env, url) {
  const hasBefore = url.searchParams.has('before');
  const hasAfter = url.searchParams.has('after');
  const before = url.searchParams.has('before')
    ? Number(url.searchParams.get('before'))
    : null;
  const after = hasAfter ? Number(url.searchParams.get('after')) : null;
  const limit = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 50;
  const page = url.searchParams.has('page') ? Number(url.searchParams.get('page')) : 1;
  const staff = (url.searchParams.get('staff') || '').trim();
  const record = (url.searchParams.get('record') || '').trim();
  const fromDate = url.searchParams.get('from') || '';
  const toDate = url.searchParams.get('to') || '';
  if ((hasBefore && hasAfter) ||
      (before !== null && (!Number.isSafeInteger(before) || before < 1)) ||
      (after !== null && (!Number.isSafeInteger(after) || after < 0)) ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(page) || page < 1 || page > 100000 ||
      staff.length > 254 || record.length > 120 ||
      (fromDate && !isValidISODate(fromDate)) ||
      (toDate && !isValidISODate(toDate)) ||
      (fromDate && toDate && fromDate > toDate)) {
    return new Response('Invalid history pagination', { status: 400 });
  }
  const { entries, total, page: currentPage } = await getScheduleHistory(env.DB, {
    beforeId: before, afterId: after, page,
    limit: after !== null || before !== null ? limit + 1 : limit,
    staff, record, fromDate, toDate,
  });
  const pageCount = Math.max(1, Math.ceil(total / limit));
  return Response.json({
    entries: entries.slice(0, limit),
    hasMore: after !== null || before !== null
      ? entries.length > limit
      : currentPage < pageCount,
    page: currentPage,
    pageCount,
    total,
  });
}

