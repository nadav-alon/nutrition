import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import type { LogEntry, LogStore, NewLogEntry } from './log-store.ts'
import { servings, type Servings } from './servings.ts'

const { grams, kcal } = nutrition

export const schnitzel: NewLogEntry = {
  name: 'Schnitzel plate',
  source: { kind: 'food', foodId: nutrition.foodId('schnitzel') },
  nutrition: { kcal: kcal(650), proteinG: grams(30), carbsG: grams(70), fatG: grams(25) },
  servings: servings(1.5),
  mealType: 'lunch',
  eatenAt: new Date('2026-03-10T12:30:00Z'),
}

export const quickToast: NewLogEntry = {
  name: 'Toast',
  source: { kind: 'quick' },
  nutrition: { kcal: kcal(180), proteinG: grams(6), carbsG: grams(30), fatG: grams(3) },
  servings: servings(1),
  mealType: 'breakfast',
  eatenAt: new Date('2026-03-10T07:00:00Z'),
}

export const DAY_START = new Date('2026-03-10T00:00:00Z')
export const DAY_END = new Date('2026-03-11T00:00:00Z')

/** The latest snapshot a Day watch delivered, once it satisfies `ready`. */
export function watchDay(store: LogStore, start = DAY_START, end = DAY_END) {
  let latest: readonly LogEntry[] | undefined
  const unsubscribe = store.watchDay(start, end, (entries) => {
    latest = entries
  })
  return {
    unsubscribe,
    latest: () => latest,
    /** Waits until the snapshot's entry names equal `names`. */
    async names(names: readonly string[]) {
      await vi.waitFor(() => expect(latest?.map((entry) => entry.name)).toEqual(names))
    },
  }
}

/**
 * The behaviour every `LogStore` adapter has. `makeStore` gives a store with no entries, acting
 * as one Member.
 */
export function logStoreContract(name: string, makeStore: () => Promise<LogStore>) {
  describe(`${name} as a LogStore`, () => {
    let store: LogStore

    beforeEach(async () => {
      store = await makeStore()
    })

    describe('reading a Day', () => {
      it('is empty before anything is logged', async () => {
        const day = watchDay(store)
        await day.names([])
        day.unsubscribe()
      })

      it('returns what was created, with the id create gave', async () => {
        const id = await store.create(schnitzel)
        const day = watchDay(store)
        await day.names(['Schnitzel plate'])
        expect(day.latest()).toEqual([{ ...schnitzel, id }])
        day.unsubscribe()
      })

      it('creates a Quick Entry as well as a Food entry', async () => {
        await store.create(quickToast)
        const day = watchDay(store)
        await day.names(['Toast'])
        expect(day.latest()?.[0]?.source).toEqual({ kind: 'quick' })
        day.unsubscribe()
      })

      it('keeps a Quick Entry marked estimated, and leaves the flag off one that is not', async () => {
        await store.create({ ...quickToast, estimated: true })
        await store.create(schnitzel)
        const day = watchDay(store)
        await day.names(['Toast', 'Schnitzel plate'])
        expect(day.latest()?.map((entry) => entry.estimated)).toEqual([true, undefined])
        day.unsubscribe()
      })

      it('rejects an entry whose servings are not positive or whose name is empty', async () => {
        await expect(store.create({ ...quickToast, servings: 0 as number as Servings })).rejects.toThrow()
        await expect(store.create({ ...quickToast, servings: -1 as number as Servings })).rejects.toThrow()
        await expect(store.create({ ...quickToast, name: '' })).rejects.toThrow()
        const day = watchDay(store)
        await day.names([])
        day.unsubscribe()
      })

      it('returns the entries eaten from start up to, not including, end, oldest first', async () => {
        await store.create(schnitzel)
        await store.create(quickToast)
        await store.create({ ...quickToast, name: 'Before', eatenAt: new Date('2026-03-09T23:59:59Z') })
        await store.create({ ...quickToast, name: 'At end', eatenAt: DAY_END })
        const day = watchDay(store)
        await day.names(['Toast', 'Schnitzel plate'])
        day.unsubscribe()
      })

      it('updates live as entries are created, and stops after unsubscribe', async () => {
        const day = watchDay(store)
        await day.names([])
        await store.create(quickToast)
        await day.names(['Toast'])
        day.unsubscribe()
        await store.create(schnitzel)
        const another = watchDay(store)
        await another.names(['Toast', 'Schnitzel plate'])
        expect(day.latest()?.map((entry) => entry.name)).toEqual(['Toast'])
        another.unsubscribe()
      })
    })

    describe('reading the most recent entries', () => {
      it('is empty before anything is logged', async () => {
        expect(await store.recent(5)).toEqual([])
      })

      it('returns entries across Days, newest first, up to the limit', async () => {
        await store.create({ ...quickToast, name: 'Monday', eatenAt: new Date('2026-03-09T08:00:00Z') })
        await store.create({ ...quickToast, name: 'Wednesday', eatenAt: new Date('2026-03-11T08:00:00Z') })
        await store.create({ ...quickToast, name: 'Tuesday', eatenAt: new Date('2026-03-10T08:00:00Z') })
        const names = async (limit: number) => (await store.recent(limit)).map((entry) => entry.name)
        expect(await names(2)).toEqual(['Wednesday', 'Tuesday'])
        expect(await names(10)).toEqual(['Wednesday', 'Tuesday', 'Monday'])
      })

      it('skips deleted entries and still fills the limit from older ones', async () => {
        await store.create({ ...quickToast, name: 'Old', eatenAt: new Date('2026-03-08T08:00:00Z') })
        const gone = await store.create({ ...quickToast, name: 'Gone', eatenAt: new Date('2026-03-09T08:00:00Z') })
        const alsoGone = await store.create({ ...quickToast, name: 'Also gone', eatenAt: new Date('2026-03-10T08:00:00Z') })
        await store.create({ ...quickToast, name: 'New', eatenAt: new Date('2026-03-11T08:00:00Z') })
        await store.softDelete(gone)
        await store.softDelete(alsoGone)
        expect((await store.recent(2)).map((entry) => entry.name)).toEqual(['New', 'Old'])
      })
    })

    describe('updating', () => {
      const entryNamed = async (name: string) => {
        const day = watchDay(store)
        await day.names([name])
        day.unsubscribe()
        return day.latest()![0]!
      }

      it('changes the Meal Type and eaten time, leaving the rest as it was', async () => {
        const id = await store.create(schnitzel)
        const eatenAt = new Date('2026-03-10T19:15:00Z')
        await store.update(id, { mealType: 'dinner', eatenAt })
        expect(await entryNamed('Schnitzel plate')).toEqual({ ...schnitzel, id, mealType: 'dinner', eatenAt })
      })

      it('rescales the totals from the entry itself when servings change', async () => {
        const id = await store.create(schnitzel)
        await store.update(id, { servings: servings(3) })
        const entry = await entryNamed('Schnitzel plate')
        expect(entry.servings).toBe(3)
        expect(entry.nutrition).toEqual({ kcal: 1300, proteinG: 60, carbsG: 140, fatG: 50 })
      })

      it('rescales from the last snapshot, not the original Food', async () => {
        const id = await store.create(schnitzel)
        await store.update(id, { servings: servings(3) })
        await store.update(id, { servings: servings(0.75) })
        const entry = await entryNamed('Schnitzel plate')
        expect(entry.nutrition).toEqual({ kcal: 325, proteinG: 15, carbsG: 35, fatG: 12.5 })
      })

      it('keeps the totals when only the Meal Type changes', async () => {
        const id = await store.create(schnitzel)
        await store.update(id, { mealType: 'snack' })
        expect((await entryNamed('Schnitzel plate')).nutrition).toEqual(schnitzel.nutrition)
      })

      it('rejects servings that are not positive', async () => {
        const id = await store.create(schnitzel)
        await expect(store.update(id, { servings: 0 as number as Servings })).rejects.toThrow()
        await expect(store.update(id, { servings: -1 as number as Servings })).rejects.toThrow()
        expect((await entryNamed('Schnitzel plate')).servings).toBe(1.5)
      })

      it('rejects an entry that is deleted or does not exist', async () => {
        const id = await store.create(schnitzel)
        await store.softDelete(id)
        await expect(store.update(id, { servings: servings(2) })).rejects.toThrow()
        await expect(store.update(nutrition.logEntryId('missing'), { servings: servings(2) })).rejects.toThrow()
      })
    })

    describe('the Google Health queue', () => {
      it('is empty before anything is logged', async () => {
        expect(await store.unsynced()).toEqual([])
      })

      it('holds every entry never pushed, across Days, oldest first, tagged create', async () => {
        const wednesday = await store.create({ ...quickToast, name: 'Wednesday', eatenAt: new Date('2026-03-11T08:00:00Z') })
        const monday = await store.create({ ...quickToast, name: 'Monday', eatenAt: new Date('2026-03-09T08:00:00Z') })
        expect(await store.unsynced()).toEqual([
          { work: 'create', entry: { ...quickToast, name: 'Monday', eatenAt: new Date('2026-03-09T08:00:00Z'), id: monday } },
          { work: 'create', entry: { ...quickToast, name: 'Wednesday', eatenAt: new Date('2026-03-11T08:00:00Z'), id: wednesday } },
        ])
      })

      it('leaves out an entry deleted before it was ever pushed', async () => {
        const id = await store.create(schnitzel)
        await store.softDelete(id)
        expect(await store.unsynced()).toEqual([])
      })
    })

    describe('recording a push', () => {
      const pushed = nutrition.googleHealthId('users/me/dataTypes/nutrition/dataPoints/1')

      it('takes the entry off the queue and keeps the id on it', async () => {
        const id = await store.create(schnitzel)
        await store.create(quickToast)
        await store.recordPushed(id, pushed)
        expect((await store.unsynced()).map(({ entry }) => entry.name)).toEqual(['Toast'])
        const day = watchDay(store)
        await day.names(['Toast', 'Schnitzel plate'])
        expect(day.latest()?.[1]).toEqual({ ...schnitzel, id, googleHealthId: pushed })
        day.unsubscribe()
      })

      it('queues a pushed entry for replacement once it is updated, and clears that when pushed again', async () => {
        const id = await store.create(schnitzel)
        await store.recordPushed(id, pushed)
        await store.update(id, { mealType: 'dinner' })
        const queued = await store.unsynced()
        expect(queued.map(({ work }) => work)).toEqual(['replace'])
        expect(queued[0]?.entry).toEqual({ ...schnitzel, id, mealType: 'dinner', googleHealthId: pushed, googleHealthStale: true })
        const again = nutrition.googleHealthId('users/me/dataTypes/nutrition/dataPoints/2')
        await store.recordPushed(id, again)
        expect(await store.unsynced()).toEqual([])
        const day = watchDay(store)
        await day.names(['Schnitzel plate'])
        expect(day.latest()?.[0]).toEqual({ ...schnitzel, id, mealType: 'dinner', googleHealthId: again })
        day.unsubscribe()
      })

      it('leaves an entry never pushed as create when it is updated', async () => {
        const id = await store.create(schnitzel)
        await store.update(id, { mealType: 'dinner' })
        const queued = await store.unsynced()
        expect(queued.map(({ work }) => work)).toEqual(['create'])
        expect(queued[0]?.entry.googleHealthStale).toBeUndefined()
      })

      it('rejects an entry that does not exist', async () => {
        await expect(store.recordPushed(nutrition.logEntryId('missing'), pushed)).rejects.toThrow()
      })
    })

    describe('removing a pushed entry', () => {
      const pushed = nutrition.googleHealthId('users/me/dataTypes/nutrition/dataPoints/1')

      it('queues a deleted pushed entry as remove, even when it was stale, and hides it from reads', async () => {
        const id = await store.create(schnitzel)
        await store.create(quickToast)
        await store.recordPushed(id, pushed)
        await store.update(id, { mealType: 'dinner' })
        await store.softDelete(id)
        const queued = (await store.unsynced()).filter(({ work }) => work === 'remove')
        expect(queued.map(({ entry }) => entry.id)).toEqual([id])
        expect(queued[0]?.entry.googleHealthId).toBe(pushed)
        const day = watchDay(store)
        await day.names(['Toast'])
        day.unsubscribe()
        expect((await store.recent(10)).map((entry) => entry.name)).toEqual(['Toast'])
      })

      it('orders removals among the other work by when the entry was eaten', async () => {
        const gone = await store.create({ ...quickToast, name: 'Gone', eatenAt: new Date('2026-03-10T08:00:00Z') })
        await store.create({ ...quickToast, name: 'Later', eatenAt: new Date('2026-03-12T08:00:00Z') })
        await store.create({ ...quickToast, name: 'Earlier', eatenAt: new Date('2026-03-09T08:00:00Z') })
        await store.recordPushed(gone, pushed)
        await store.softDelete(gone)
        expect((await store.unsynced()).map(({ work, entry }) => [work, entry.name])).toEqual([
          ['create', 'Earlier'],
          ['remove', 'Gone'],
          ['create', 'Later'],
        ])
      })

      it('takes the entry off the queue once recordRemoved, on a deleted entry', async () => {
        const id = await store.create(schnitzel)
        await store.recordPushed(id, pushed)
        await store.softDelete(id)
        await store.recordRemoved(id)
        expect(await store.unsynced()).toEqual([])
      })

      it('records a new id on a deleted entry, which stays queued as remove and hidden from reads', async () => {
        const again = nutrition.googleHealthId('users/me/dataTypes/nutrition/dataPoints/2')
        const id = await store.create(schnitzel)
        await store.recordPushed(id, pushed)
        await store.softDelete(id)
        await store.recordPushed(id, again)
        expect(await store.unsynced()).toEqual([{ work: 'remove', entry: { ...schnitzel, id, googleHealthId: again } }])
        const day = watchDay(store)
        await day.names([])
        expect(await store.recent(10)).toEqual([])
      })

      it('clears the id and the stale flag on a live entry, which is then queued as create', async () => {
        const id = await store.create(schnitzel)
        await store.recordPushed(id, pushed)
        await store.update(id, { mealType: 'dinner' })
        await store.recordRemoved(id)
        const queued = await store.unsynced()
        expect(queued).toEqual([{ work: 'create', entry: { ...schnitzel, id, mealType: 'dinner' } }])
      })

      it('rejects an entry that does not exist', async () => {
        await expect(store.recordRemoved(nutrition.logEntryId('missing'))).rejects.toThrow()
      })
    })

    describe('soft deleting', () => {
      it('removes the entry from its Day, and leaves the others', async () => {
        const id = await store.create(schnitzel)
        await store.create(quickToast)
        const day = watchDay(store)
        await day.names(['Toast', 'Schnitzel plate'])
        await store.softDelete(id)
        await day.names(['Toast'])
        day.unsubscribe()
      })

      it('never returns a deleted entry to a Day read opened afterwards', async () => {
        const id = await store.create(schnitzel)
        await store.softDelete(id)
        const day = watchDay(store)
        await day.names([])
        day.unsubscribe()
      })

      it('is a no-op on an entry already deleted', async () => {
        const id = await store.create(schnitzel)
        await store.softDelete(id)
        await store.softDelete(id)
        const day = watchDay(store)
        await day.names([])
        day.unsubscribe()
      })
    })
  })
}
