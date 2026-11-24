import { dayOf } from '../day.ts'

declare const localInputBrand: unique symbol

/** A `datetime-local` input's value, in the local time zone: `YYYY-MM-DDTHH:mm`. */
export type LocalInput = string & { readonly [localInputBrand]: true }

const LOCAL_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** The guard: whether `value` is written `YYYY-MM-DDTHH:mm`. */
export function isLocalInput(value: string): value is LocalInput {
  return LOCAL_INPUT_PATTERN.test(value)
}

/** The constructor: narrows, or throws naming the offending value. */
export function localInput(value: string): LocalInput {
  if (!isLocalInput(value)) throw new Error(`Not a local input value: ${JSON.stringify(value)}`)
  return value
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `value` as a `datetime-local` input writes it, in the local time zone, to the minute. */
export function toLocalInput(value: Date): LocalInput {
  return localInput(`${dayOf(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`)
}

/** The instant a `datetime-local` value names in the local time zone, or undefined when it is empty or not a time. */
export function fromLocalInput(value: string): Date | undefined {
  // Browsers may append seconds, so only the minute-precision prefix is required.
  if (!isLocalInput(value.slice(0, 16))) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
