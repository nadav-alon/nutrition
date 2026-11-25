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

/** The query key each field of an estimate link is read from. */
const QUERY_KEYS = {
  name: 'name',
  place: 'place',
  kcal: 'kcal',
  proteinG: 'protein',
  carbsG: 'carbs',
  fatG: 'fat',
  servings: 'servings',
  estimated: 'est',
} as const

/**
 * The estimate link a query string carries (`name`, `place`, `kcal`, `protein`, `carbs`, `fat`,
 * `servings`, `est`), or undefined when it carries none of them. A value that is missing or invalid
 * (non-numeric, negative, a blank name) is left empty, or at 1 for servings, so the form's own
 * validation decides whether the Member can save.
 */
export function parseEstimateLink(query: string): EstimateLink | undefined {
  const params = new URLSearchParams(query)
  if (!Object.values(QUERY_KEYS).some((key) => params.has(key))) return undefined
  const read = (field: keyof typeof QUERY_KEYS) => params.get(QUERY_KEYS[field])
  const servings = nonNegative(read('servings'))
  return {
    name: read('name')?.trim() ?? '',
    place: read('place')?.trim() ?? '',
    kcal: nonNegative(read('kcal')),
    proteinG: nonNegative(read('proteinG')),
    carbsG: nonNegative(read('carbsG')),
    fatG: nonNegative(read('fatG')),
    servings: servings === '' || Number(servings) === 0 ? '1' : servings,
    estimated: read('estimated') === '1',
  }
}
