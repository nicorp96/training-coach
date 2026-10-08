// Calendar dates are ISO strings (YYYY-MM-DD) handled in UTC to avoid DST/timezone drift.

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};
export const toIso = (dt: Date) => dt.toISOString().slice(0, 10);

/** Local calendar date of `dt` as ISO, without converting to UTC. */
export const localIso = (dt: Date = new Date()) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

export const addDays = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
};
/** Monday = 0 … Sunday = 6 */
export const weekday = (iso: string) => (toDate(iso).getUTCDay() + 6) % 7;
export const startOfWeek = (iso: string) => addDays(iso, -weekday(iso));
export const startOfMonth = (iso: string) => iso.slice(0, 8) + '01';
export const addMonths = (iso: string, n: number) => {
  const d = toDate(iso);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
};
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000);
export const dayOfMonth = (iso: string) => toDate(iso).getUTCDate();
export const monthIndex = (iso: string) => toDate(iso).getUTCMonth();

export const longDate = (iso: string) => `${WEEKDAYS_LONG[weekday(iso)]}, ${dayOfMonth(iso)} ${MONTHS[monthIndex(iso)]}`;
export const shortDate = (iso: string) => `${WEEKDAYS[weekday(iso)]} ${dayOfMonth(iso)} ${MONTHS[monthIndex(iso)]!.slice(0, 3)}`;

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};
export const fromMinutes = (n: number) => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
