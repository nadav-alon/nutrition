import type { nutrition } from 'data-platform'
import type { Servings } from './servings.ts'

/** A Log Entry as the app reads it. `nutrition` is the totals for all `servings`, a snapshot taken when it was logged. */
export interface LogEntry {
  readonly id: nutrition.LogEntryId
  readonly name: string
  readonly source: nutrition.LogEntrySource
  readonly nutrition: nutrition.Nutrition
  readonly servings: Servings
  readonly mealType: nutrition.MealType
  readonly eatenAt: Date
}

/** What logging something needs: a Food's entry carries `source.foodId`, a Quick Entry's source is `{ kind: 'quick' }`. */
export type NewLogEntry = Omit<LogEntry, 'id'>

/** The only fields of a Log Entry that change after logging. */
export type LogEntryEdit = Partial<Pick<LogEntry, 'servings' | 'mealType' | 'eatenAt'>>

export type Unsubscribe = () => void

/**
 * The signed-in Member's Log Entries. Soft-deleted entries are never returned by any read.
 */
export interface LogStore {
  /**
   * Calls `onEntries` with the live entries eaten in `[start, end)`, oldest first, now and again
   * after every change. An empty Day is an empty array.
   */
  watchDay(
    start: Date,
    end: Date,
    onEntries: (entries: readonly LogEntry[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe
  /** The most recent live entries across Days, newest first, at most `limit`; it feeds Recents. */
  recent(limit: number): Promise<readonly LogEntry[]>
  create(entry: NewLogEntry): Promise<nutrition.LogEntryId>
  /**
   * Changes servings, Meal Type and eaten time, and nothing else. Changing servings rescales the
   * Nutrition totals from the entry's own snapshot, never from the Food. Rejects for an entry that
   * does not exist or is deleted.
   */
  update(id: nutrition.LogEntryId, edit: LogEntryEdit): Promise<void>
  /** Soft deletes an entry; it is never returned again. Deleting one already deleted is a no-op. */
  softDelete(id: nutrition.LogEntryId): Promise<void>
}
