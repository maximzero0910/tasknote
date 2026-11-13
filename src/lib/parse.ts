import { resolveDatePhrase, todayISO } from "./dates.ts";
import type { Priority, Recurrence } from "./types.ts";

export type ParsedDraft = {
  content: string;
  priority: Priority;
  projectName: string | null;
  labelNames: string[];
  due: string | null;
  dueTime: string | null;
  recurrence: Recurrence | null;
};

const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const UNIT_WORDS = /^(day|days|week|weeks|month|months|year|years)$/;

function unitOf(word: string): Recurrence["unit"] {
  if (word.startsWith("day")) return "day";
  if (word.startsWith("week")) return "week";
  if (word.startsWith("month")) return "month";
  return "year";
}

function parseClock(token: string): string | null {
  const lower = token.toLowerCase();
  if (lower === "noon") return "12:00";
  if (lower === "midnight") return "00:00";
  const match = lower.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!match) return null;
  // A bare number such as "9" is never a time; it needs a colon or am/pm.
  if (!match[2] && !match[3]) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3];
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Parses text such as "every 2 weeks", "every other day", "every mon, wed" or "every! month". */
export function parseRecurrence(text: string): Recurrence | null {
  const raw = text.trim().toLowerCase().replace(/,/g, " ");
  const afterCompletion = /\b(?:after|from) completion\b/.test(raw) || /^every!/.test(raw);
  const cleaned = raw
    .replace(/\b(?:after|from) completion\b/g, "")
    .replace(/^every!/, "every")
    .replace(/\s+/g, " ")
    .trim();
  const from: Recurrence["from"] = afterCompletion ? "complete" : "due";

  if (cleaned === "every weekday") return { every: 1, unit: "week", weekdays: [1, 2, 3, 4, 5], from };
  if (cleaned === "every weekend") return { every: 1, unit: "week", weekdays: [0, 6], from };
  if (cleaned === "every other weekday") return null;

  const unitOnly = cleaned.match(/^every (day|week|month|year)$/);
  if (unitOnly) return { every: 1, unit: unitOf(unitOnly[1]), from };

  const counted = cleaned.match(/^every (?:(\d+)|(other)) (day|days|week|weeks|month|months|year|years)$/);
  if (counted) {
    const every = counted[2] ? 2 : Number(counted[1]);
    if (every < 1 || every > 999) return null;
    return { every, unit: unitOf(counted[3]), from };
  }

  const days = cleaned.match(/^every (.+)$/);
  if (days) {
    const names = days[1].split(" ").filter((word) => word !== "and");
    if (names.length > 0 && names.every((name) => WEEKDAY_INDEX[name] !== undefined)) {
      const weekdays = [...new Set(names.map((name) => WEEKDAY_INDEX[name]))].sort((a, b) => a - b);
      return { every: 1, unit: "week", weekdays, from };
    }
  }
  return null;
}

const RECURRENCE_VOCAB = new Set([
  "other", "and", "after", "from", "completion", "weekday", "weekend",
  ...Object.keys(WEEKDAY_INDEX),
]);

function isRecurrenceWord(token: string): boolean {
  const word = token.toLowerCase().replace(/,$/, "");
  return RECURRENCE_VOCAB.has(word) || UNIT_WORDS.test(word) || /^\d+$/.test(word);
}

function findRecurrence(tokens: string[]): { start: number; end: number; rule: Recurrence } | null {
  for (let i = 0; i < tokens.length; i += 1) {
    if (!/^every!?$/i.test(tokens[i])) continue;
    let reach = i + 1;
    while (reach < tokens.length && isRecurrenceWord(tokens[reach])) reach += 1;
    for (let end = reach; end > i + 1; end -= 1) {
      const rule = parseRecurrence(tokens.slice(i, end).join(" "));
      if (rule) return { start: i, end: end - 1, rule };
    }
  }
  return null;
}

function takeTagged(input: string, marker: "#" | "@"): { name: string; rest: string } | null {
  const re = new RegExp(`(?:^|\\s)${marker}(?:"([^"]+)"|([\\p{L}\\p{N}][\\p{L}\\p{N}_-]*))`, "u");
  const match = re.exec(input);
  if (!match) return null;
  const name = (match[1] ?? match[2]).trim();
  const rest = `${input.slice(0, match.index)} ${input.slice(match.index + match[0].length)}`
    .replace(/\s+/g, " ")
    .trim();
  return { name, rest };
}

/**
 * Quick-add grammar: `p1`–`p4`, `#Project` or `#"Project name"`, `@label`,
 * dates ("tomorrow", "next friday", "nov 20", "3/14"), times ("9am", "at 14:30"),
 * and repeats ("every week", "every other day", "every mon, wed").
 * Anything not recognised stays in the title.
 */
export function parseQuickAdd(input: string, now = new Date()): ParsedDraft {
  let rest = input.replace(/\s+/g, " ").trim();
  let priority: Priority = 4;
  let projectName: string | null = null;
  const labelNames: string[] = [];

  const priorityMatch = rest.match(/(?:^|\s)p([1-4])(?=\s|$)/i);
  if (priorityMatch) {
    priority = Number(priorityMatch[1]) as Priority;
    rest = rest.replace(priorityMatch[0], " ").replace(/\s+/g, " ").trim();
  }

  for (let i = 0; i < 8; i += 1) {
    const found = takeTagged(rest, "#");
    if (!found) break;
    projectName = found.name;
    rest = found.rest;
  }
  for (let i = 0; i < 12; i += 1) {
    const found = takeTagged(rest, "@");
    if (!found) break;
    if (!labelNames.some((name) => name.toLowerCase() === found.name.toLowerCase())) labelNames.push(found.name);
    rest = found.rest;
  }

  const tokens = rest ? rest.split(" ") : [];
  const consumed = new Set<number>();
  let recurrence: Recurrence | null = null;
  let dueTime: string | null = null;
  let due: string | null = null;

  const repeat = findRecurrence(tokens);
  if (repeat) {
    recurrence = repeat.rule;
    for (let i = repeat.start; i <= repeat.end; i += 1) consumed.add(i);
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i) || dueTime) continue;
    const clock = parseClock(tokens[i]);
    if (!clock) continue;
    dueTime = clock;
    consumed.add(i);
    if (i > 0 && tokens[i - 1].toLowerCase() === "at" && !consumed.has(i - 1)) consumed.add(i - 1);
  }

  let best: { start: number; end: number; date: string } | null = null;
  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed.has(i)) continue;
    for (let size = 3; size >= 1; size -= 1) {
      const slice = tokens.slice(i, i + size);
      if (slice.length < size || slice.some((_, k) => consumed.has(i + k))) continue;
      const date = resolveDatePhrase(slice.join(" "), now);
      if (!date) continue;
      if (!best || size > best.end - best.start + 1) best = { start: i, end: i + size - 1, date };
      break;
    }
  }
  if (best) {
    due = best.date;
    for (let i = best.start; i <= best.end; i += 1) consumed.add(i);
    if (best.start > 0 && tokens[best.start - 1].toLowerCase() === "on" && !consumed.has(best.start - 1)) {
      consumed.add(best.start - 1);
    }
  }

  // A time with no date means "today"; a repeat with no date starts today.
  if (!due && (dueTime || recurrence)) due = todayISO(now);

  const content = tokens.filter((_, i) => !consumed.has(i)).join(" ").trim();
  return { content, priority, projectName, labelNames, due, dueTime, recurrence };
}
