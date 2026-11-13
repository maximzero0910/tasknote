import type { Recurrence } from "./types.ts";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export function formatISO(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(now = new Date()): string {
  return formatISO(now);
}

/** True for real calendar dates such as 2026-02-28, false for 2026-02-31. */
export function isValidISO(iso: unknown): iso is string {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return formatISO(date);
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function weekday(iso: string): number {
  return parseISO(iso).getDay();
}

export function startOfWeek(iso: string, weekStartsOn: 0 | 1): string {
  const delta = (weekday(iso) - weekStartsOn + 7) % 7;
  return addDays(iso, -delta);
}

/** Adds calendar months, clamping the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const date = parseISO(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, last));
  return formatISO(date);
}

export function addYears(iso: string, years: number): string {
  return addMonths(iso, years * 12);
}

export function formatLong(iso: string, now = new Date()): string {
  const today = todayISO(now);
  if (iso === today) return "Today";
  if (iso === addDays(today, 1)) return "Tomorrow";
  if (iso === addDays(today, -1)) return "Yesterday";
  const date = parseISO(iso);
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatTime(hhmm: string): string {
  const [hRaw, mRaw] = hhmm.split(":");
  let h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  const suffix = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h}${suffix}` : `${h}:${String(m).padStart(2, "0")}${suffix}`;
}

function shift(iso: string, every: number, unit: Recurrence["unit"]): string {
  if (unit === "day") return addDays(iso, every);
  if (unit === "week") return addDays(iso, every * 7);
  if (unit === "month") return addMonths(iso, every);
  return addYears(iso, every);
}

/**
 * Next due date strictly after both `anchor` and `notBefore`.
 * Weekday rules walk forward day by day; interval rules keep stepping so an
 * overdue completion never lands in the past.
 */
export function nextDueDate(recurrence: Recurrence, anchor: string, notBefore: string): string {
  const every = Math.max(1, Math.floor(recurrence.every) || 1);
  const weekdays = recurrence.weekdays?.length
    ? [...new Set(recurrence.weekdays.map((d) => ((d % 7) + 7) % 7))]
    : null;

  if (!weekdays) {
    let cursor = shift(anchor, every, recurrence.unit);
    let guard = 0;
    while (cursor <= notBefore && guard < 1000) {
      cursor = shift(cursor, every, recurrence.unit);
      guard += 1;
    }
    return cursor;
  }

  // Weekday schedule. A day qualifies when its Monday-based week is a
  // multiple of `every` weeks after the anchor's week (the anchor week itself
  // counts too, so "every Mon, Wed" completed on Monday gives Wednesday).
  const anchorWeek = startOfWeek(anchor, 1);
  let cursor = addDays(anchor, 1);
  for (let guard = 0; guard < 366 * every + 14; guard += 1) {
    if (weekdays.includes(weekday(cursor)) && cursor > notBefore) {
      const weeks = Math.round(
        (parseISO(startOfWeek(cursor, 1)).getTime() - parseISO(anchorWeek).getTime()) / (7 * 86400000),
      );
      if (weeks >= 0 && weeks % every === 0) return cursor;
    }
    cursor = addDays(cursor, 1);
  }
  return addDays(anchor, 7 * every);
}

function weekdayIndex(name: string): number {
  if (name.length < 3) return -1;
  return WEEKDAYS.findIndex((day) => day.startsWith(name));
}

function monthIndex(name: string): number {
  if (name.length < 3) return -1;
  return MONTHS.findIndex((month) => month.startsWith(name));
}

function nextWeekday(today: string, target: number): string {
  let cursor = addDays(today, 1);
  for (let i = 0; i < 7; i += 1) {
    if (weekday(cursor) === target) return cursor;
    cursor = addDays(cursor, 1);
  }
  return cursor;
}

function monthDay(year: number, month: number, day: number, today: string, rollForward: boolean): string | null {
  const candidate = formatISO(new Date(year, month, day));
  if (!isValidISO(candidate) || new Date(year, month, day).getDate() !== day) return null;
  if (rollForward && candidate < today) return monthDay(year + 1, month, day, today, false);
  return candidate;
}

/** Turns a short phrase such as "tomorrow", "next friday", "nov 20" or "3/14" into YYYY-MM-DD. */
export function resolveDatePhrase(phrase: string, now = new Date()): string | null {
  const text = phrase.trim().toLowerCase().replace(/,/g, "");
  const today = todayISO(now);
  if (!text) return null;
  if (text === "today") return today;
  if (text === "tomorrow") return addDays(today, 1);
  if (text === "yesterday") return addDays(today, -1);
  if (text === "next week") return nextWeekday(today, 1);
  if (text === "next month") return addMonths(today, 1);
  if (text === "next year") return addYears(today, 1);
  if (text === "this weekend") {
    return weekday(today) === 6 ? today : nextWeekday(today, 6);
  }

  const inMatch = text.match(/^in\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$/);
  if (inMatch) {
    const n = Number(inMatch[1]);
    const unit = inMatch[2];
    if (unit.startsWith("day")) return addDays(today, n);
    if (unit.startsWith("week")) return addDays(today, n * 7);
    if (unit.startsWith("month")) return addMonths(today, n);
    return addYears(today, n);
  }

  const wdMatch = text.match(/^(?:(next|this)\s+)?([a-z]+)$/);
  if (wdMatch) {
    const wd = weekdayIndex(wdMatch[2]);
    if (wd >= 0) {
      if (wdMatch[1] === "this" && weekday(today) === wd) return today;
      return nextWeekday(today, wd);
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isValidISO(text) ? text : null;

  const slash = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = slash[3] ? Number(slash[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month < 1 || month > 12) return null;
    return monthDay(year, month - 1, day, today, !slash[3]);
  }

  const named =
    text.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/) ??
    (() => {
      const flipped = text.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/);
      return flipped ? [flipped[0], flipped[2], flipped[1], flipped[3]] : null;
    })();
  if (named) {
    const month = monthIndex(named[1]);
    const day = Number(named[2]);
    if (month < 0) return null;
    const year = named[3] ? Number(named[3]) : now.getFullYear();
    return monthDay(year, month, day, today, !named[3]);
  }
  return null;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(recurrence: Recurrence): string {
  const { every, unit, weekdays: days } = recurrence;
  const suffix = recurrence.from === "complete" ? " after completion" : "";
  if (days?.length) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
    const key = sorted.join(",");
    if (every === 1 && key === "1,2,3,4,5") return `every weekday${suffix}`;
    if (every === 1 && key === "0,6") return `every weekend${suffix}`;
    const list = sorted.map((d) => DAY_NAMES[d]).join(", ");
    return `${every === 1 ? "every" : `every ${every} weeks on`} ${list}${suffix}`;
  }
  const noun = every === 1 ? unit : `${unit}s`;
  return `${every === 1 ? `every ${noun}` : `every ${every} ${noun}`}${suffix}`;
}
