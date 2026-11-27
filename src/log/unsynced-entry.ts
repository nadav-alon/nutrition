import type { LogEntry, UnsyncedEntry } from './log-store.ts'

/** `entry` with its push work tagged, or `undefined` when nothing is outstanding; both adapters build `unsynced()` from it. */
export function unsyncedEntry(entry: LogEntry, isDeleted: boolean): UnsyncedEntry | undefined {
  if (isDeleted) return entry.googleHealthId === undefined ? undefined : { work: 'remove', entry }
  if (entry.googleHealthId === undefined) return { work: 'create', entry }
  return entry.googleHealthStale ? { work: 'replace', entry } : undefined
}
