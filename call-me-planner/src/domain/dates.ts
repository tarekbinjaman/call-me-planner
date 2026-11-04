import { addDays, addMonths, endOfMonth, format, isValid, parse } from 'date-fns';

/** Local calendar date as 'YYYY-MM-DD' (the format stored in scheduled_date / target_date). */
export function toLocalDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseLocalDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(date) && toLocalDate(date) === value ? date : null;
}

export function isLocalDate(value: string): boolean {
  return parseLocalDate(value) !== null;
}

/** 'HH:mm', 24-hour. */
export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function minutesOfDay(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Short, friendly date: "Fri 30 Nov"; adds the year only when it isn't this year. */
export function formatShortDate(value: string, today: Date = new Date()): string {
  const date = parseLocalDate(value);
  if (!date) return value;
  return format(date, date.getFullYear() === today.getFullYear() ? 'EEE d MMM' : 'd MMM yyyy');
}

/** Quick choices for a target date. */
export function quickDates(today: Date = new Date()) {
  return [
    { label: 'In 1 week', value: toLocalDate(addDays(today, 7)) },
    { label: 'End of month', value: toLocalDate(endOfMonth(today)) },
    { label: 'In 1 month', value: toLocalDate(addMonths(today, 1)) },
    { label: 'In 3 months', value: toLocalDate(addMonths(today, 3)) },
  ];
}

export const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
] as const;

/** "Mon–Fri 09:00–13:00", "Mon, Wed 14:00–18:00", or "No set hours". */
export function describeWorkHours(hours: { days: number[]; start: string; end: string } | null): string {
  if (!hours || hours.days.length === 0) return 'No set hours';
  const order = WEEKDAYS.map((d) => d.value as number);
  const days = [...hours.days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const names = days.map((d) => WEEKDAYS.find((w) => w.value === d)?.short ?? '?');
  const positions = days.map((d) => order.indexOf(d));
  const consecutive = positions.every((p, i) => i === 0 || p === (positions[i - 1] ?? -2) + 1);
  const dayText =
    consecutive && names.length >= 3 ? `${names[0]}–${names[names.length - 1]}` : names.join(', ');
  return `${dayText} ${hours.start}–${hours.end}`;
}
