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
  /** Set when the Nutrition is an estimate; only a Quick Entry carries it, a Food's entry leaves it to the Food. Absent means it is not. */
  readonly estimated?: true
  /** The Google Health data point this entry was pushed as. Absent means it has not been pushed. */
  readonly googleHealthId?: nutrition.GoogleHealthId
  /** Set when the pushed data point no longer matches the entry; only meaningful alongside `googleHealthId`. Absent means it matches. */
  readonly googleHealthStale?: true
}

/** What logging something needs: a Food's entry carries `source.foodId`, a Quick Entry's source is `{ kind: 'quick' }`. */
export type NewLogEntry = Omit<LogEntry, 'id' | 'googleHealthId' | 'googleHealthStale'>

/** The only fields of a Log Entry that change after logging. */
export type LogEntryEdit = Partial<Pick<LogEntry, 'servings' | 'mealType' | 'eatenAt'>>

/**
 * What a Log Entry still needs from Google Health: `create` a live entry never pushed, `replace`
 * a live one whose pushed data point is stale, `remove` a soft-deleted one still carrying its data point.
 */
export type PushWork = 'create' | 'replace' | 'remove'

/** A Log Entry with push work outstanding, tagged with that work. */
export interface UnsyncedEntry {
  readonly work: PushWork
  readonly entry: LogEntry
}

export type Unsubscribe = () => void

/**
 * The signed-in Member's Log Entries. Soft-deleted entries are never returned by any read except
 * `unsynced()`, which returns those still awaiting removal from Google Health.
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
  /**
   * Every entry with push work outstanding, across Days, oldest eaten first. Nothing outstanding is
   * an empty array.
   */
  unsynced(): Promise<readonly UnsyncedEntry[]>
  /**
   * Records that the entry is now Google Health data point `googleHealthId` and matches it: sets
   * the id and clears `googleHealthStale`. Works on a soft-deleted entry; rejects for one that does not exist.
   */
  recordPushed(id: nutrition.LogEntryId, googleHealthId: nutrition.GoogleHealthId): Promise<void>
  /**
   * Records that the entry's data point is gone from Google Health: clears `googleHealthId` and
   * `googleHealthStale`. Works on a soft-deleted entry; rejects for one that does not exist.
   */
  recordRemoved(id: nutrition.LogEntryId): Promise<void>
}
