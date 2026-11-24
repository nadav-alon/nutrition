import { rescaleNutrition } from './rescale.ts'
import type { LogEntryEdit, LogEntryRecord } from './log-store.ts'

/** `entry` with `edit` applied: only servings, Meal Type and eaten time change, and new servings rescale the totals. */
export function applyEdit(entry: LogEntryRecord, edit: LogEntryEdit): LogEntryRecord {
  const servings = edit.servings ?? entry.servings
  if (!(servings > 0) || !Number.isFinite(servings)) throw new Error(`Servings must be a positive number, got ${servings}`)
  return {
    ...entry,
    servings,
    mealType: edit.mealType ?? entry.mealType,
    eatenAt: edit.eatenAt ?? entry.eatenAt,
    nutrition: servings === entry.servings ? entry.nutrition : rescaleNutrition(entry.nutrition, entry.servings, servings),
  }
}
