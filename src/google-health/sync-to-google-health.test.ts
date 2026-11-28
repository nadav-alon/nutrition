import { describe, expect, it } from 'vitest'
import { fakeLogStore } from '../log/fake-log-store.ts'
import { schnitzel } from '../log/log-store.contract.ts'
import { fakeGoogleHealth } from './fake-google-health.ts'
import { HealthRequestError } from './google-health.ts'
import { syncToGoogleHealth } from './sync-to-google-health.ts'

const at = (hour: number) => new Date(`2026-11-27T${hour}:00:00Z`)

describe('syncToGoogleHealth', () => {
  it('pushes a new entry and records its data point', async () => {
    const logStore = fakeLogStore()
    const health = fakeGoogleHealth({ connected: true })
    await logStore.create(schnitzel)
    expect(await syncToGoogleHealth(logStore, health)).toEqual({ status: 'synced', pushed: 1, queued: 0 })
    expect(health.created).toHaveLength(1)
    expect(await logStore.unsynced()).toEqual([])
  })

  it('replaces the data point of an edited entry', async () => {
    const logStore = fakeLogStore()
    const health = fakeGoogleHealth({ connected: true })
    const id = await logStore.create(schnitzel)
    await syncToGoogleHealth(logStore, health)
    await logStore.update(id, { mealType: 'dinner' })
    expect(await syncToGoogleHealth(logStore, health)).toEqual({ status: 'synced', pushed: 1, queued: 0 })
    expect(health.created.map((point) => point.entry.mealType)).toEqual(['dinner'])
    expect(await logStore.unsynced()).toEqual([])
  })

  it('removes the data point of a deleted entry', async () => {
    const logStore = fakeLogStore()
    const health = fakeGoogleHealth({ connected: true })
    const id = await logStore.create(schnitzel)
    await syncToGoogleHealth(logStore, health)
    await logStore.softDelete(id)
    expect(await syncToGoogleHealth(logStore, health)).toEqual({ status: 'synced', pushed: 1, queued: 0 })
    expect(health.created).toEqual([])
    expect(await logStore.unsynced()).toEqual([])
  })

  it('does nothing when not connected, and reports what is queued', async () => {
    const logStore = fakeLogStore()
    const health = fakeGoogleHealth()
    await logStore.create(schnitzel)
    expect(await syncToGoogleHealth(logStore, health)).toEqual({ status: 'not-connected', queued: 1 })
    expect(health.created).toEqual([])
    expect(await logStore.unsynced()).toHaveLength(1)
  })

  it('stops at the first failure, reporting the typed error, and the next run picks up where it stopped', async () => {
    const logStore = fakeLogStore()
    const health = fakeGoogleHealth({ connected: true })
    await logStore.create({ ...schnitzel, eatenAt: at(10) })
    await logStore.create({ ...schnitzel, eatenAt: at(11) })
    await logStore.create({ ...schnitzel, eatenAt: at(12) })
    const error = new HealthRequestError(429, 'Quota exceeded')
    // Lets the first create through, then queues a failure for the second.
    const failingSecond = {
      ...health,
      create: async (entry: Parameters<typeof health.create>[0]) => {
        const name = await health.create(entry)
        health.fail(error)
        return name
      },
    }

    const stopped = await syncToGoogleHealth(logStore, failingSecond)
    expect(stopped).toEqual({ status: 'failed', pushed: 1, queued: 2, error })
    expect(health.created).toHaveLength(1)
    expect((await logStore.unsynced()).map(({ work }) => work)).toEqual(['create', 'create'])

    expect(await syncToGoogleHealth(logStore, health)).toEqual({ status: 'synced', pushed: 2, queued: 0 })
    expect(health.created).toHaveLength(3)
  })
})
