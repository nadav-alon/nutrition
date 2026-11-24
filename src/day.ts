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

function startOf(value: Day): Date {
  const { year, month, date } = parts(value)!
  return new Date(year, month - 1, date)
}

/** The instant a Day starts: local midnight. Inclusive bound for querying Log Entries. */
export function dayStart(value: Day): Date {
  return startOf(value)
}

/** The instant the Day after `value` starts. Exclusive bound for querying Log Entries. */
export function dayEnd(value: Day): Date {
  const { year, month, date } = parts(value)!
  return new Date(year, month - 1, date + 1)
}

/** The Day before `value`. */
export function previousDay(value: Day): Day {
  const { year, month, date } = parts(value)!
  const stepped = new Date(year, month - 1, date - 1)
  return dayOf(stepped)
}

/** The Day after `value`, never past today: stepping forward from today stays on today. */
export function nextDay(value: Day, now: Date): Day {
  const today = dayOf(now)
  if (value >= today) return today
  return dayOf(dayEnd(value))
}
