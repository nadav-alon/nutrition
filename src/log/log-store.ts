import type { nutrition } from 'data-platform'

/** A Log Entry as the app reads it. `nutrition` is the totals for all `servings`, a snapshot taken when it was logged. */
export interface LogEntryRecord {
  readonly id: nutrition.LogEntryId
  readonly name: string
  readonly source: nutrition.LogEntrySource
  readonly nutrition: nutrition.Nutrition
  readonly servings: number
  readonly mealType: nutrition.MealType
  readonly eatenAt: Date
}

/** What logging something needs: a Food's entry carries `source.foodId`, a Quick Entry's source is `{ kind: 'quick' }`. */
export type NewLogEntry = Omit<LogEntryRecord, 'id'>

/** The only fields of a Log Entry that change after logging. */
export type LogEntryEdit = Partial<Pick<LogEntryRecord, 'servings' | 'mealType' | 'eatenAt'>>

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
    onEntries: (entries: readonly LogEntryRecord[]) => void,
    onError?: (error: Error) => void,
  ): Unsubscribe
  create(entry: NewLogEntry): Promise<nutrition.LogEntryId>
  /** Soft deletes an entry; it is never returned again. Deleting one already deleted is a no-op. */
  softDelete(id: nutrition.LogEntryId): Promise<void>
}
