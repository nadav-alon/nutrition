import { nutrition } from 'data-platform'
import { byName, type FoodFields, type Foods, type SavedFood } from './foods.ts'

/** An in-memory `Foods`, for tests of everything that reads or writes the Household's Foods. */
export function fakeFoods(): Foods {
  const saved = new Map<nutrition.FoodId, SavedFood>()
  const listeners = new Set<(foods: readonly SavedFood[]) => void>()
  let counter = 0

  const notify = () => {
    const live = [...saved.values()].sort(byName)
    for (const listener of listeners) listener(live)
  }

  return {
    watch(listener) {
      listeners.add(listener)
      listener([...saved.values()].sort(byName))
      return () => listeners.delete(listener)
    },
    async add(fields: FoodFields) {
      const id = nutrition.foodId(`food-${++counter}`)
      saved.set(id, { ...fields, id })
      notify()
      return id
    },
    async edit(id, changes) {
      const food = saved.get(id)
      if (food === undefined) throw new Error(`No such Food: ${id}`)
      const { place, servingLabel, ...rest } = changes
      const next: SavedFood = { ...food, ...rest }
      if (place !== undefined) next.place = place ?? undefined
      if (servingLabel !== undefined) next.servingLabel = servingLabel ?? undefined
      saved.set(id, next)
      notify()
    },
    async softDelete(id) {
      if (!saved.delete(id)) throw new Error(`No such Food: ${id}`)
      notify()
    },
  }
}
