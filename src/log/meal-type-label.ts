import { nutrition } from 'data-platform'

/** The guard: whether `value` is one of the platform's Meal Types. */
export function isMealType(value: string): value is nutrition.MealType {
  return nutrition.mealTypeSchema.safeParse(value).success
}

/** A Meal Type as the Member reads it: capitalised. */
export function mealTypeLabel(type: nutrition.MealType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}
