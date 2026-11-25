import { nutrition } from 'data-platform'
import { byName, type FoodFields, type Foods, type SavedFood } from './foods.ts'

/** An in-memory `Foods`, for tests of everything that reads or writes the Household's Foods. */
export function fakeFoods(): Foods {
  const saved = new Map<nutrition.FoodId, SavedFood>()
  const deleted = new Set<nutrition.FoodId>()
  const listeners = new Set<(foods: readonly SavedFood[]) => void>()
  let counter = 0

  const live = () => [...saved.values()].filter((food) => !deleted.has(food.id)).sort(byName)
  const notify = () => {
    const list = live()
    for (const listener of listeners) listener(list)
  }
  const liveFood = (id: nutrition.FoodId) => {
    const food = saved.get(id)
    if (food === undefined || deleted.has(id)) throw new Error(`No such Food: ${id}`)
    return food
  }

  return {
    watch(listener) {
      listeners.add(listener)
      listener(live())
      return () => listeners.delete(listener)
    },
    async add(fields: FoodFields) {
      const id = nutrition.foodId(`food-${++counter}`)
      saved.set(id, { ...fields, id })
      notify()
      return id
    },
    async edit(id, changes) {
      const food = liveFood(id)
      const { place, servingLabel, ...rest } = changes
      const next: SavedFood = { ...food, ...rest }
      if (place !== undefined) next.place = place ?? undefined
      if (servingLabel !== undefined) next.servingLabel = servingLabel ?? undefined
      saved.set(id, next)
      notify()
    },
    async softDelete(id) {
      liveFood(id)
      deleted.add(id)
      notify()
    },
  }
}
