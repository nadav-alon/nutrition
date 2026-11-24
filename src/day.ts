declare const dayBrand: unique symbol

/** A local calendar day, midnight to midnight, written `YYYY-MM-DD`. */
export type Day = string & { readonly [dayBrand]: true }

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: string): { year: number; month: number; date: number } | undefined {
  const match = DAY_PATTERN.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const date = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, date))
  const real =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === date
  return real ? { year, month, date } : undefined
}

/** The guard: whether `value` is a real calendar date written `YYYY-MM-DD`. */
export function isDay(value: string): value is Day {
  return parts(value) !== undefined
}

/** The constructor: narrows, or throws naming the offending value. */
export function day(value: string): Day {
  if (!isDay(value)) throw new Error(`Not a Day: ${JSON.stringify(value)}`)
  return value
}

function format(year: number, month: number, date: number): Day {
  const pad = (n: number, width: number) => String(n).padStart(width, '0')
  return day(`${pad(year, 4)}-${pad(month, 2)}-${pad(date, 2)}`)
}

/** The Day `instant` falls in, in the local time zone. */
export function dayOf(instant: Date): Day {
  return format(instant.getFullYear(), instant.getMonth() + 1, instant.getDate())
}
