import { nutrition as platformNutrition } from 'data-platform'

import type { Servings } from './servings.ts'

const { grams, kcal } = platformNutrition

/**
 * A Log Entry's Nutrition totals for `newServings`, scaled from the entry's own snapshot
 * (totals ÷ old servings × new), never from the Food the entry was made from.
 */
export function rescaleNutrition(
  totals: platformNutrition.Nutrition,
  oldServings: Servings,
  newServings: Servings,
): platformNutrition.Nutrition {
  const scale = (value: number) => (value / oldServings) * newServings
  return {
    ...totals,
    kcal: kcal(scale(totals.kcal)),
    proteinG: grams(scale(totals.proteinG)),
    carbsG: grams(scale(totals.carbsG)),
    fatG: grams(scale(totals.fatG)),
  }
}
