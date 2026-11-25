import { nutrition } from 'data-platform'
import { isDay, type Day } from './day.ts'

/** Where the app is: one per screen. */
export type Route =
  | { name: 'day'; day: Day }
  | { name: 'log'; day: Day }
  | { name: 'entry'; day: Day; id: nutrition.LogEntryId }
  | { name: 'foods' }
  | { name: 'targets' }

/**
 * The location hash for `route`. Routes live in the hash because the app is served from static
 * hosting, where a deeper path would 404 on refresh.
 */
export function hashFor(route: Route): string {
  switch (route.name) {
    case 'day':
      return `#/day/${route.day}`
    case 'log':
      return `#/day/${route.day}/log`
    case 'entry':
      return `#/day/${route.day}/entry/${encodeURIComponent(route.id)}`
    case 'foods':
      return '#/foods'
    case 'targets':
      return '#/targets'
  }
}

/** The route a location `hash` names. A hash that names none, such as an empty one, is today's Day. */
export function parseRoute(hash: string, today: Day): Route {
  const [first, second, third, fourth, ...rest] = hash.replace(/^#\/?/, '').split('/')
  if (rest.length === 0) {
    if (first === 'foods' && second === undefined) return { name: 'foods' }
    if (first === 'targets' && second === undefined) return { name: 'targets' }
    if (first === 'day' && second !== undefined && isDay(second)) {
      if (third === undefined) return { name: 'day', day: second }
      if (third === 'log' && fourth === undefined) return { name: 'log', day: second }
      if (third === 'entry' && fourth !== undefined) {
        const id = decodeId(fourth)
        if (id !== undefined) return { name: 'entry', day: second, id }
      }
    }
  }
  return { name: 'day', day: today }
}

function decodeId(text: string): nutrition.LogEntryId | undefined {
  try {
    const decoded = decodeURIComponent(text)
    return nutrition.isLogEntryId(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}
