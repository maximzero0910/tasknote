import { forwardRef, useMemo, useState } from "react";
import { describeRecurrence, formatLong, formatTime } from "../lib/dates.ts";
import { parseQuickAdd } from "../lib/parse.ts";
import { quickAdd, type QuickContext } from "../lib/actions.ts";

type Props = QuickContext & { placeholder?: string; hint?: boolean; autoFocus?: boolean; onDone?: () => void };

/** One-line task entry with a live preview of what the parser understood. */
export const QuickAdd = forwardRef<HTMLInputElement, Props>(function QuickAdd(
  { placeholder = "Add a task", hint = false, autoFocus = false, onDone, ...ctx },
  ref,
) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseQuickAdd(text) : null), [text]);
  const chips: string[] = [];
  if (parsed) {
    if (parsed.due) chips.push(formatLong(parsed.due) + (parsed.dueTime ? ` ${formatTime(parsed.dueTime)}` : ""));
    else if (parsed.dueTime) chips.push(formatTime(parsed.dueTime));
    if (parsed.recurrence) chips.push(describeRecurrence(parsed.recurrence));
    if (parsed.priority < 4) chips.push(`P${parsed.priority}`);
    if (parsed.projectName) chips.push(`#${parsed.projectName}`);
    parsed.labelNames.forEach((l) => chips.push(`@${l}`));
  }
  return (
    <form
      className="quickadd"
      onSubmit={(event) => {
        event.preventDefault();
        if (quickAdd(text, ctx)) {
          setText("");
          onDone?.();
        }
      }}
    >
      <div className="quickadd-row">
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setText("");
              onDone?.();
            }
          }}
          enterKeyHint="done"
          autoComplete="off"
        />
        <button type="submit" className="btn btn-accent">
          Add
        </button>
      </div>
      {chips.length > 0 ? (
        <p className="chips" aria-label="Parsed details">
          {chips.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </p>
      ) : (
        hint && <p className="hint">Try “Call Dana tomorrow 9am p1 #Studio @errand every week”. Press Q to focus.</p>
      )}
    </form>
  );
});
