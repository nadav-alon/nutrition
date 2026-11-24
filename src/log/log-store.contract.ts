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
