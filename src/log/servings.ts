declare const servingsBrand: unique symbol

/** How many servings a Log Entry covers: positive and finite, fractions allowed. */
export type Servings = number & { readonly [servingsBrand]: true }

/** The guard. */
export function isServings(value: number): value is Servings {
  return value > 0 && Number.isFinite(value)
}

/** The constructor: narrows, or throws naming the offending value. */
export function servings(value: number): Servings {
  if (!isServings(value)) throw new Error(`Servings must be a positive number, got ${value}`)
  return value
}
