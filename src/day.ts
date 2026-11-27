declare const dayBrand: unique symbol

/** A local calendar day, midnight to midnight, written `YYYY-MM-DD`. */
export type Day = string & { readonly [dayBrand]: true }

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parts(value: string): { year: number; month: number; dayOfMonth: number } | undefined {
  const match = DAY_PATTERN.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const dayOfMonth = Number(match[3])
  const probe = new Date(Date.UTC(year, month - 1, dayOfMonth))
  const real =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === dayOfMonth
  return real ? { year, month, dayOfMonth } : undefined
}

/** The guard: whether `value` is a real calendar day written `YYYY-MM-DD`. */
export function isDay(value: string): value is Day {
  return parts(value) !== undefined
}

/** The constructor: narrows, or throws naming the offending value. */
export function day(value: string): Day {
  if (!isDay(value)) throw new Error(`Not a Day: ${JSON.stringify(value)}`)
  return value
}

function format({ year, month, dayOfMonth }: { year: number; month: number; dayOfMonth: number }): Day {
  const pad = (n: number, width: number) => String(n).padStart(width, '0')
  return day(`${pad(year, 4)}-${pad(month, 2)}-${pad(dayOfMonth, 2)}`)
}

/** The Day `instant` falls in, in the local time zone. */
export function dayOf(instant: Date): Day {
  return format({
    year: instant.getFullYear(),
    month: instant.getMonth() + 1,
    dayOfMonth: instant.getDate(),
  })
}

/** Local midnight `offsetDays` from the start of `value`, plus an optional clock time. */
function localMidnight(value: Day, offsetDays = 0, clock?: Date): Date {
  const { year, month, dayOfMonth } = parts(value)!
  return clock
    ? new Date(
        year,
        month - 1,
        dayOfMonth + offsetDays,
        clock.getHours(),
        clock.getMinutes(),
        clock.getSeconds(),
        clock.getMilliseconds(),
      )
    : new Date(year, month - 1, dayOfMonth + offsetDays)
}

/** The instant a Day starts: local midnight. Inclusive bound for querying Log Entries. */
export function dayStart(value: Day): Date {
  return localMidnight(value)
}

/** The instant the Day after `value` starts. Exclusive bound for querying Log Entries. */
export function dayEnd(value: Day): Date {
  return localMidnight(value, 1)
}

/** The Day before `value`. */
export function previousDay(value: Day): Day {
  return dayOf(localMidnight(value, -1))
}

/** The Day after `value`, never past today: stepping forward from today stays on today. */
export function nextDay(value: Day, now: Date): Day {
  const today = dayOf(now)
  // Plain string comparison is calendar order only because a Day is always zero-padded `YYYY-MM-DD`.
  if (value >= today) return today
  return dayOf(dayEnd(value))
}

/**
 * The eaten time to offer when logging on `value`: `now` when the Day is today, otherwise that Day
 * at the current clock time. A clock time the Day skips (a DST gap) lands just after the gap; one it
 * repeats (a fall-back) lands on the first occurrence.
 */
export function defaultEatenTime(value: Day, now: Date): Date {
  if (value === dayOf(now)) return new Date(now)
  return localMidnight(value, 0, now)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * How a Member reads `value` as the header of the Day screen, relative to `now`: `Today`,
 * `Yesterday`, or a short label like `Thu 26 Nov`, with the year (`Thu 26 Nov 2025`) only when it
 * isn't the current one.
 */
export function dayLabel(value: Day, now: Date): string {
  const today = dayOf(now)
  if (value === today) return 'Today'
  if (value === previousDay(today)) return 'Yesterday'
  const { year, month, dayOfMonth } = parts(value)!
  const weekday = WEEKDAYS[localMidnight(value).getDay()]
  const withoutYear = `${weekday} ${dayOfMonth} ${MONTHS[month - 1]}`
  return year === now.getFullYear() ? withoutYear : `${withoutYear} ${year}`
}
