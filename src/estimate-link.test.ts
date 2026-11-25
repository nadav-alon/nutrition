import { describe, expect, it } from 'vitest'
import { parseEstimateLink } from './estimate-link.ts'

describe('parseEstimateLink', () => {
  it('reads a full link', () => {
    expect(
      parseEstimateLink('name=Shawarma%20plate&place=Hummus%20Bar&kcal=820&protein=41&carbs=70.5&fat=38&servings=1.5&est=1'),
    ).toEqual({
      name: 'Shawarma plate',
      place: 'Hummus Bar',
      kcal: '820',
      proteinG: '41',
      carbsG: '70.5',
      fatG: '38',
      servings: '1.5',
      estimated: true,
    })
  })

  it('leaves what a partial link omits empty, with servings 1 and not Estimated', () => {
    expect(parseEstimateLink('name=Soup&kcal=200')).toEqual({
      name: 'Soup',
      place: '',
      kcal: '200',
      proteinG: '',
      carbsG: '',
      fatG: '',
      servings: '1',
      estimated: false,
    })
  })

  it('leaves non-numeric, negative and blank values empty, and servings at 1', () => {
    expect(parseEstimateLink('name=%20&kcal=abc&protein=-3&carbs=&fat=Infinity&servings=-2&est=yes')).toEqual({
      name: '',
      place: '',
      kcal: '',
      proteinG: '',
      carbsG: '',
      fatG: '',
      servings: '1',
      estimated: false,
    })
  })

  it('is undefined when the query carries none of the parameters', () => {
    expect(parseEstimateLink('')).toBeUndefined()
    expect(parseEstimateLink('foo=bar')).toBeUndefined()
  })
})
