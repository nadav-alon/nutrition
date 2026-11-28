import { nutrition } from 'data-platform'
import type { LogStore, UnsyncedEntry } from '../log/log-store.ts'
import { HealthRequestError, NotConnectedError, NotLinkedError, dataPointName } from './google-health.ts'
import type { GoogleHealth } from './google-health.ts'

/** The failures the Google Health port promises; anything else is a bug and is thrown. */
export type GoogleHealthError = NotLinkedError | NotConnectedError | HealthRequestError

/**
 * What a run of `syncToGoogleHealth` did. `queued` is how many entries still have push work
 * outstanding afterwards, for the Sync chip.
 */
export type SyncResult =
  | { readonly status: 'not-connected'; readonly queued: number }
  | { readonly status: 'synced'; readonly pushed: number; readonly queued: number }
  | {
      readonly status: 'failed'
      readonly pushed: number
      readonly queued: number
      readonly error: GoogleHealthError
    }

async function remove({ entry }: UnsyncedEntry, googleHealth: GoogleHealth): Promise<void> {
  if (entry.googleHealthId === undefined) throw new Error(`Log Entry ${entry.id} has no data point to remove`)
  await googleHealth.remove([dataPointName(entry.googleHealthId)])
}

async function push(item: UnsyncedEntry, logStore: LogStore, googleHealth: GoogleHealth): Promise<void> {
  const { work, entry } = item
  switch (work) {
    case 'create':
      break
    case 'replace':
      await remove(item, googleHealth)
      break
    case 'remove':
      await remove(item, googleHealth)
      await logStore.recordRemoved(entry.id)
      return
  }
  const name = await googleHealth.create(entry)
  await logStore.recordPushed(entry.id, nutrition.googleHealthId(name))
}

const isGoogleHealthError = (error: unknown): error is GoogleHealthError =>
  error instanceof NotLinkedError || error instanceof NotConnectedError || error instanceof HealthRequestError

/**
 * Works through the Log store's queue in order against Google Health. Does nothing when not
 * connected. Stops at the first failure, leaving that entry and the rest queued for the next run.
 * Only the port's own errors are reported as a failure; anything else is thrown.
 */
export async function syncToGoogleHealth(logStore: LogStore, googleHealth: GoogleHealth): Promise<SyncResult> {
  const queue = await logStore.unsynced()
  if (!googleHealth.isConnected()) return { status: 'not-connected', queued: queue.length }
  let pushed = 0
  for (const unsynced of queue) {
    try {
      await push(unsynced, logStore, googleHealth)
    } catch (error) {
      if (!isGoogleHealthError(error)) throw error
      return { status: 'failed', pushed, queued: queue.length - pushed, error }
    }
    pushed++
  }
  return { status: 'synced', pushed, queued: 0 }
}
