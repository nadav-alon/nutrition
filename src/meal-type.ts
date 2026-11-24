import type { nutrition } from 'data-platform'

const LUNCH_FROM = 11 * 60
const DINNER_FROM = 16 * 60
const SNACK_AFTER = 21 * 60 + 30

/**
 * The Meal Type guessed from the local time eaten: before 11:00 breakfast, before 16:00 lunch,
 * until 21:30 dinner, after that snack. Matches the household MCP's `log_food`.
 */
export function guessMealType(eaten: Date): nutrition.MealType {
  const minutes = eaten.getHours() * 60 + eaten.getMinutes()
  if (minutes < LUNCH_FROM) return 'breakfast'
  if (minutes < DINNER_FROM) return 'lunch'
  if (minutes <= SNACK_AFTER) return 'dinner'
  return 'snack'
}
