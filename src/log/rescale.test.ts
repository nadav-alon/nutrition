import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { rescaleNutrition } from './rescale.ts'

const { kcal, grams } = nutrition

describe('rescaleNutrition', () => {
  it('divides the totals by the old servings and multiplies by the new', () => {
    const totals = { kcal: kcal(975), proteinG: grams(45), carbsG: grams(105), fatG: grams(37.5) }
    expect(rescaleNutrition(totals, 1.5, 3)).toEqual({
      kcal: 1950,
      proteinG: 90,
      carbsG: 210,
      fatG: 75,
    })
  })
})
