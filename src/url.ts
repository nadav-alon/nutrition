declare const urlBrand: unique symbol

/** A link target: an absolute URL, or a path on this origin. */
export type Url = string & { readonly [urlBrand]: true }

/** The guard: whether `value` parses as an absolute URL or a path on this origin. */
export function isUrl(value: string): value is Url {
  try {
    new URL(value, 'https://origin.invalid')
    return value.trim() === value && value !== ''
  } catch {
    return false
  }
}

/** The constructor: narrows, or throws naming the offending value. */
export function url(value: string): Url {
  if (!isUrl(value)) throw new Error(`Not a Url: ${JSON.stringify(value)}`)
  return value
}
