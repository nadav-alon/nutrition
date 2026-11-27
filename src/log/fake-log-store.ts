import { nutrition } from 'data-platform'
import { applyEdit } from './apply-edit.ts'
import { servings } from './servings.ts'
import type { LogEntry, LogStore, NewLogEntry, PushWork, Unsubscribe } from './log-store.ts'

interface Watcher {
  readonly start: Date
  readonly end: Date
  readonly onEntries: (entries: readonly LogEntry[]) => void
}

/** Which push work `entry` has outstanding, if any. */
function pushWork(entry: LogEntry, isDeleted: boolean): PushWork | undefined {
  if (isDeleted) return entry.googleHealthId === undefined ? undefined : 'remove'
  if (entry.googleHealthId === undefined) return 'create'
  return entry.googleHealthStale ? 'replace' : undefined
}

/** An in-memory `LogStore`; the Firestore adapter must pass the same contract. */
export function fakeLogStore(): LogStore {
  const entries = new Map<nutrition.LogEntryId, LogEntry>()
  const deleted = new Set<nutrition.LogEntryId>()
  const watchers = new Set<Watcher>()
  let counter = 0

  const inDay = ({ start, end }: Watcher) =>
    [...entries.values()]
      .filter((entry) => !deleted.has(entry.id) && entry.eatenAt >= start && entry.eatenAt < end)
      .sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime())

  const notify = () => {
    for (const watcher of watchers) watcher.onEntries(inDay(watcher))
  }

  return {
    watchDay(start, end, onEntries): Unsubscribe {
      const watcher = { start, end, onEntries }
      watchers.add(watcher)
      onEntries(inDay(watcher))
      return () => watchers.delete(watcher)
    },
    async recent(limit) {
      return [...entries.values()]
        .filter((entry) => !deleted.has(entry.id))
        .sort((a, b) => b.eatenAt.getTime() - a.eatenAt.getTime())
        .slice(0, limit)
    },
    async create(entry: NewLogEntry) {
      servings(entry.servings)
      if (entry.name === '') throw new Error('A Log Entry needs a name')
      const id = nutrition.logEntryId(`entry-${counter++}`)
      entries.set(id, { ...entry, id })
      notify()
      return id
    },
    async update(id, edit) {
      const entry = entries.get(id)
      if (!entry || deleted.has(id)) throw new Error(`No live Log Entry ${id}`)
      const edited = applyEdit(entry, edit)
      entries.set(id, edited.googleHealthId === undefined ? edited : { ...edited, googleHealthStale: true })
      notify()
    },
    async softDelete(id) {
      deleted.add(id)
      notify()
    },
    async recordPushed(id, googleHealthId) {
      const entry = entries.get(id)
      if (!entry) throw new Error(`No Log Entry ${id}`)
      const { googleHealthStale: _stale, ...matching } = entry
      entries.set(id, { ...matching, googleHealthId })
      notify()
    },
    async recordRemoved(id) {
      const entry = entries.get(id)
      if (!entry) throw new Error(`No Log Entry ${id}`)
      const { googleHealthId: _id, googleHealthStale: _stale, ...unsynced } = entry
      entries.set(id, unsynced)
      notify()
    },
    async unsynced() {
      return [...entries.values()]
        .sort((a, b) => a.eatenAt.getTime() - b.eatenAt.getTime())
        .flatMap((entry) => {
          const work = pushWork(entry, deleted.has(entry.id))
          return work ? [{ work, entry }] : []
        })
    },
  }
}
