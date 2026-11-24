import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import type { FoodFields, Foods, SavedFood } from './foods.ts'

export const schnitzel: FoodFields = {
  name: 'Canteen schnitzel',
  place: 'Work canteen',
  servingLabel: '1 plate',
  perServing: { kcal: nutrition.kcal(620), proteinG: nutrition.grams(34), carbsG: nutrition.grams(41), fatG: nutrition.grams(33) },
  estimated: true,
}

export const apple: FoodFields = {
  name: 'Apple',
  perServing: { kcal: nutrition.kcal(95), proteinG: nutrition.grams(0.5), carbsG: nutrition.grams(25), fatG: nutrition.grams(0.3) },
  estimated: false,
}

/** The Foods currently listed, once the listing has settled on a list satisfying `ready`. */
export function listed(foods: Foods, ready: (list: readonly SavedFood[]) => boolean = () => true): Promise<readonly SavedFood[]> {
  return new Promise((resolve) => {
    const stop = foods.watch((list) => {
      if (!ready(list)) return
      queueMicrotask(() => stop())
      resolve(list)
    })
  })
}

/** The behaviour every `Foods` adapter keeps; `open` returns one over an empty Household. */
export function foodsContract(name: string, open: () => Promise<Foods>) {
  describe(`${name} as Foods`, () => {
    it('lists nothing for a Household with no Foods', async () => {
      expect(await listed(await open())).toEqual([])
    })

    it('adds a Food and lists it under the id add returned', async () => {
      const foods = await open()
      const id = await foods.add(schnitzel)
      expect(await listed(foods, (list) => list.length > 0)).toEqual([{ ...schnitzel, id }])
    })

    it('adds a Food with no place or serving label', async () => {
      const foods = await open()
      const id = await foods.add(apple)
      const [food] = await listed(foods, (list) => list.length > 0)
      expect(food).toMatchObject({ ...apple, id })
      expect(food?.place).toBeUndefined()
      expect(food?.servingLabel).toBeUndefined()
    })

    it('lists Foods by name', async () => {
      const foods = await open()
      await foods.add(schnitzel)
      await foods.add(apple)
      const list = await listed(foods, (l) => l.length === 2)
      expect(list.map((f) => f.name)).toEqual(['Apple', 'Canteen schnitzel'])
    })

    it('tells a watcher about each change as it happens', async () => {
      const foods = await open()
      const seen: number[] = []
      const stop = foods.watch((list) => seen.push(list.length))
      await listed(foods)
      await foods.add(apple)
      await listed(foods, (l) => l.length === 1)
      await foods.add(schnitzel)
      await listed(foods, (l) => l.length === 2)
      stop()
      expect(seen[0]).toBe(0)
      expect(seen.at(-1)).toBe(2)
    })

    it('edits every field of a Food', async () => {
      const foods = await open()
      const id = await foods.add(apple)
      await foods.edit(id, { name: 'Green apple', place: 'Market', servingLabel: '1 medium', perServing: schnitzel.perServing, estimated: true })
      expect(await listed(foods, (l) => l[0]?.name === 'Green apple')).toEqual([
        { id, name: 'Green apple', place: 'Market', servingLabel: '1 medium', perServing: schnitzel.perServing, estimated: true },
      ])
    })

    it('leaves what an edit does not name as it was', async () => {
      const foods = await open()
      const id = await foods.add(schnitzel)
      await foods.edit(id, { name: 'Schnitzel' })
      expect(await listed(foods, (l) => l[0]?.name === 'Schnitzel')).toEqual([{ ...schnitzel, name: 'Schnitzel', id }])
    })

    it('clears the place and serving label with null, and the Estimated flag with false', async () => {
      const foods = await open()
      const id = await foods.add(schnitzel)
      await foods.edit(id, { place: null, servingLabel: null, estimated: false })
      const [food] = await listed(foods, (l) => l[0]?.estimated === false)
      expect(food?.place).toBeUndefined()
      expect(food?.servingLabel).toBeUndefined()
    })

    it('rejects an edit of a Food that does not exist', async () => {
      const foods = await open()
      await expect(foods.edit(nutrition.foodId('missing'), { name: 'Ghost' })).rejects.toThrow()
    })
  })
}
