import { rescaleNutrition } from './rescale.ts'
import { servings as toServings } from './servings.ts'
import type { LogEntryEdit, LogEntry } from './log-store.ts'

/** `entry` with `edit` applied: only servings, Meal Type and eaten time change, and new servings rescale the totals. */
export function applyEdit(entry: LogEntry, edit: LogEntryEdit): LogEntry {
  // Re-checked at runtime so a caller that bypasses the type still meets the one checked door.
  const servings = edit.servings === undefined ? entry.servings : toServings(edit.servings)
  return {
    ...entry,
    servings,
    mealType: edit.mealType ?? entry.mealType,
    eatenAt: edit.eatenAt ?? entry.eatenAt,
    nutrition: servings === entry.servings ? entry.nutrition : rescaleNutrition(entry.nutrition, entry.servings, servings),
  }
}
