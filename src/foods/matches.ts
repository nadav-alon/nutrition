import type { SavedFood } from './foods.ts'

/** Whether the query, ignoring case and surrounding space, appears in the Food's name or place; an empty query appears in every Food. */
export function matches(food: SavedFood, query: string): boolean {
  const needle = query.trim().toLowerCase()
  return food.name.toLowerCase().includes(needle) || (food.place?.toLowerCase().includes(needle) ?? false)
}
