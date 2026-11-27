declare const hexColourBrand: unique symbol

/** A six-digit hex colour such as `#123abc`. */
export type HexColour = string & { readonly [hexColourBrand]: true }

/** The guard: whether `value` is `#` and six lowercase hex digits. */
export function isHexColour(value: string): value is HexColour {
  return /^#[0-9a-f]{6}$/.test(value)
}

/** The constructor: narrows, or throws naming the offending value. */
export function hexColour(value: string): HexColour {
  if (!isHexColour(value)) throw new Error(`Not a HexColour: ${JSON.stringify(value)}`)
  return value
}
