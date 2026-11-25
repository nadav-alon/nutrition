/**
 * What an estimate link fills the Quick Entry form with: the text of each field, empty where the
 * link gave nothing usable. `servings` is `'1'` when the link gave none.
 */
export interface EstimateLink {
  readonly name: string
  readonly place: string
  readonly kcal: string
  readonly proteinG: string
  readonly carbsG: string
  readonly fatG: string
  readonly servings: string
  readonly estimated: boolean
}

/** `value` when it is a number of zero or more, otherwise `''`. */
function nonNegative(value: string | null): string {
  if (value === null || value.trim() === '') return ''
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? value.trim() : ''
}

/**
 * The estimate link a query string carries (`name`, `place`, `kcal`, `protein`, `carbs`, `fat`,
 * `servings`, `est`), or undefined when it carries none of them. A value that is missing or invalid
 * (non-numeric, negative, a blank name) is left empty, or at 1 for servings, so the form's own
 * validation decides whether the Member can save.
 */
export function parseEstimateLink(query: string): EstimateLink | undefined {
  const params = new URLSearchParams(query)
  const fields = ['name', 'place', 'kcal', 'protein', 'carbs', 'fat', 'servings', 'est']
  if (!fields.some((field) => params.has(field))) return undefined
  const servings = nonNegative(params.get('servings'))
  return {
    name: params.get('name')?.trim() ?? '',
    place: params.get('place')?.trim() ?? '',
    kcal: nonNegative(params.get('kcal')),
    proteinG: nonNegative(params.get('protein')),
    carbsG: nonNegative(params.get('carbs')),
    fatG: nonNegative(params.get('fat')),
    servings: servings === '' || Number(servings) === 0 ? '1' : servings,
    estimated: params.get('est') === '1',
  }
}
