import { nutrition } from 'data-platform'
import type { LogStore, UnsyncedEntry } from '../log/log-store.ts'
import { dataPointName } from './google-health.ts'
import type { GoogleHealth } from './google-health.ts'

/**
 * What a run of `syncToGoogleHealth` did. `queued` is how many entries still have push work
 * outstanding afterwards, for the Sync chip.
 */
export type SyncResult =
  | { readonly status: 'not-connected'; readonly queued: number }
  | { readonly status: 'synced'; readonly pushed: number; readonly queued: number }
  | { readonly status: 'failed'; readonly pushed: number; readonly queued: number; readonly error: Error }

async function push({ work, entry }: UnsyncedEntry, logStore: LogStore, googleHealth: GoogleHealth): Promise<void> {
  if (work === 'remove' || work === 'replace') {
    if (entry.googleHealthId === undefined) throw new Error(`Log Entry ${entry.id} has no data point to remove`)
    await googleHealth.remove([dataPointName(entry.googleHealthId)])
  }
  if (work === 'remove') {
    await logStore.recordRemoved(entry.id)
    return
  }
  const name = await googleHealth.create(entry)
  await logStore.recordPushed(entry.id, nutrition.googleHealthId(name))
}

/**
 * Works through the Log store's queue in order against Google Health. Does nothing when not
 * connected. Stops at the first failure, leaving that entry and the rest queued for the next run.
 */
export async function syncToGoogleHealth(logStore: LogStore, googleHealth: GoogleHealth): Promise<SyncResult> {
  const queue = await logStore.unsynced()
  if (!googleHealth.isConnected()) return { status: 'not-connected', queued: queue.length }
  let pushed = 0
  for (const item of queue) {
    try {
      await push(item, logStore, googleHealth)
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error))
      return { status: 'failed', pushed, queued: queue.length - pushed, error: cause }
    }
    pushed++
  }
  return { status: 'synced', pushed, queued: 0 }
}
