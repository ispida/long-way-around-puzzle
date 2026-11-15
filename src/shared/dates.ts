/** Daily puzzle dates are ISO calendar dates (YYYY-MM-DD) in UTC. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True if `s` is a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(s: string): boolean {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Today's daily key in UTC, e.g. "2026-10-03". */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** A daily is published from 00:00 UTC on its date. */
export function isPublished(date: string, now: Date = new Date()): boolean {
  return isIsoDate(date) && date <= todayKey(now);
}
