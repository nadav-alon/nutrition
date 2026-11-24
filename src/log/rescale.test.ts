import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { rescaleNutrition } from './rescale.ts'
import { servings } from './servings.ts'

const { kcal, grams } = nutrition

describe('rescaleNutrition', () => {
  it('divides the totals by the old servings and multiplies by the new', () => {
    const totals = { kcal: kcal(975), proteinG: grams(45), carbsG: grams(105), fatG: grams(37.5) }
    expect(rescaleNutrition(totals, servings(1.5), servings(3))).toEqual({
      kcal: 1950,
      proteinG: 90,
      carbsG: 210,
      fatG: 75,
    })
  })
})

describe('rescaleNutrition with extra fields', () => {
  it('returns only the four scaled macros, never an extra field at its old-servings value', () => {
    const totals = { kcal: kcal(100), proteinG: grams(10), carbsG: grams(10), fatG: grams(10), fibreG: 4 }
    expect(rescaleNutrition(totals, servings(1), servings(2))).toEqual({
      kcal: 200,
      proteinG: 20,
      carbsG: 20,
      fatG: 20,
    })
  })
})
