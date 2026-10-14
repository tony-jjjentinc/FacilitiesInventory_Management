/**
 * @file datetime.ts
 * @description The one place dates and times are read and shown.
 *
 * What the API sends (api/Code.gs `normalizeDates_`): plain text in the script time zone, Asia/Manila, in two forms:
 *   date            2026-10-13
 *   date and time   2026-10-13 09:30:05      (no zone: it is Manila wall time)
 * Older cached or hand-typed values can also be an ISO string with a zone (2026-10-12T16:00:00.000Z) or a JavaScript date
 * string ("Mon Jun 29 2026 00:00:00 GMT+0800 (...)"); those are converted to Manila time.
 *
 * Screens show only the formatted result, whatever the browser's own time zone:
 *   fmtDate       Oct 13, 2026
 *   fmtDateTime   Oct 13, 2026, 9:30 AM       (a date with no time shows as a date)
 *   fmtTime       9:30 AM
 * Never `slice`/`substring` a date and never print one raw. A date is never shifted by a time zone (2026-10-13 stays Oct 13).
 */

export const APP_TIME_ZONE = 'Asia/Manila';

interface Parts { y: number; mo: number; d: number; h: number; mi: number; s: number; hasTime: boolean }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const zoneFmt = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });

function fromInstant(t: Date): Parts | null {
  if (isNaN(t.getTime())) return null;
  const p: Record<string, number> = {};
  zoneFmt.formatToParts(t).forEach(x => { if (x.type !== 'literal') p[x.type] = Number(x.value); });
  return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second, hasTime: true };
}

/** Reads any value the API or the sheets can hand over; null when it is blank or not a date. */
export function parseDateTime(v: unknown): Parts | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return fromInstant(v);
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: 0, mi: 0, s: 0, hasTime: false };
  m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/.exec(t); // no zone: already Manila wall time
  if (m) return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5], s: +(m[6] || 0), hasTime: true };
  if (/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:?\d{2})$/.test(t) || /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2}/.test(t)) {
    return fromInstant(new Date(t.replace(/\s*\(.*\)$/, '')));
  }
  return null;
}

const two = (n: number) => String(n).padStart(2, '0');
const dateText = (p: Parts) => `${MONTHS[p.mo - 1]} ${p.d}, ${p.y}`;
const timeText = (p: Parts) => `${p.h % 12 || 12}:${two(p.mi)} ${p.h < 12 ? 'AM' : 'PM'}`;

/** Oct 13, 2026. A value that is not a date is shown as it came (blank becomes `empty`). */
export function fmtDate(v: unknown, empty = '–'): string {
  const p = parseDateTime(v);
  return p ? dateText(p) : (v ? String(v) : empty);
}

/** Oct 13, 2026, 9:30 AM. A date with no time shows as a date. */
export function fmtDateTime(v: unknown, empty = '–'): string {
  const p = parseDateTime(v);
  return p ? (p.hasTime ? `${dateText(p)}, ${timeText(p)}` : dateText(p)) : (v ? String(v) : empty);
}

/** 9:30 AM */
export function fmtTime(v: unknown, empty = '–'): string {
  const p = parseDateTime(v);
  return p && p.hasTime ? timeText(p) : (v ? String(v) : empty);
}

/** yyyy-MM-dd for an <input type="date">, or '' */
export function toInputDate(v: unknown): string {
  const p = parseDateTime(v);
  return p ? `${p.y}-${two(p.mo)}-${two(p.d)}` : '';
}

/** Today in Manila as yyyy-MM-dd, whatever the browser's time zone. */
export function todayInputDate(): string {
  return toInputDate(new Date());
}

/** Milliseconds since 1970 for sorting and range tests (Manila is UTC+8 all year, no daylight saving); 0 when unreadable. */
export function toTimestamp(v: unknown): number {
  const p = parseDateTime(v);
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - 8 * 3600000 : 0;
}

/** 'just now', '3 min ago', '2 h ago', then the date */
export function fmtAgo(v: unknown): string {
  const t = typeof v === 'number' ? v : toTimestamp(v);
  if (!t) return '–';
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : fmtDate(new Date(t));
}
