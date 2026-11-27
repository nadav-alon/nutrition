import { nutrition } from 'data-platform'
import { isDay, type Day } from './day.ts'
import { parseEstimateLink, type EstimateLink } from './estimate-link.ts'

/** Where the app is: one per screen. */
export type Route =
  | { name: 'day'; day: Day }
  | { name: 'log'; day: Day; estimate?: EstimateLink }
  | { name: 'entry'; day: Day; id: nutrition.LogEntryId }
  | { name: 'foods'; form?: 'new' | nutrition.FoodId }
  | { name: 'targets' }

/** The hash of today's Day: `parseRoute` reads it, like an empty hash, as whichever Day is today. */
export const HOME_HASH = '#/'

/**
 * The location hash for `route`. Routes live in the hash because the app is served from static
 * hosting, where a deeper path would 404 on refresh. An estimate link is only ever read, never
 * written, so `hashFor` leaves it out. Today's Day is written as the bare `#/`, which `parseRoute`
 * reads as whichever Day is today when it is read, so a reopened app never pins a past Day.
 */
export function hashFor(route: Route, today: Day): string {
  switch (route.name) {
    case 'day':
      return route.day === today ? HOME_HASH : `#/day/${route.day}`
    case 'log':
      return `#/day/${route.day}/log`
    case 'entry':
      return `#/day/${route.day}/entry/${encodeURIComponent(route.id)}`
    case 'foods':
      return route.form === undefined ? '#/foods' : `#/foods/${encodeURIComponent(route.form)}`
    case 'targets':
      return '#/targets'
  }
}

/**
 * The route a location `hash` names. A hash that names none, such as an empty one or `HOME_HASH`, is today's Day.
 * `#/log?…` is the Log screen on today's Day, opened on a Quick Entry when the query is an estimate link.
 */
export function parseRoute(hash: string, today: Day): Route {
  const [path = '', ...queryParts] = hash.replace(/^#\/?/, '').split('?')
  const estimate = parseEstimateLink(queryParts.join('?'))
  const [first, second, third, fourth, ...rest] = path.split('/')
  if (first === 'log' && second === undefined) return withEstimate({ name: 'log', day: today }, estimate)
  if (rest.length === 0) {
    if (first === 'foods' && second === undefined && third === undefined) return { name: 'foods' }
    if (first === 'foods' && second !== undefined && third === undefined) {
      if (second === 'new') return { name: 'foods', form: 'new' }
      const id = decodeFoodId(second)
      if (id !== undefined) return { name: 'foods', form: id }
    }
    if (first === 'targets' && second === undefined) return { name: 'targets' }
    if (first === 'day' && second !== undefined && isDay(second)) {
      if (third === undefined) return { name: 'day', day: second }
      if (third === 'log' && fourth === undefined) return withEstimate({ name: 'log', day: second }, estimate)
      if (third === 'entry' && fourth !== undefined) {
        const id = decodeId(fourth)
        if (id !== undefined) return { name: 'entry', day: second, id }
      }
    }
  }
  return { name: 'day', day: today }
}

function withEstimate(route: Extract<Route, { name: 'log' }>, estimate: EstimateLink | undefined): Route {
  return estimate === undefined ? route : { ...route, estimate }
}

function decodeId(text: string): nutrition.LogEntryId | undefined {
  try {
    const decoded = decodeURIComponent(text)
    return nutrition.isLogEntryId(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}

function decodeFoodId(text: string): nutrition.FoodId | undefined {
  try {
    const decoded = decodeURIComponent(text)
    return nutrition.isFoodId(decoded) ? decoded : undefined
  } catch {
    return undefined
  }
}

/** The route codec bound to `today`, so a caller cannot mix Days between writing and reading. */
export function routesFor(today: Day): { hashFor: (route: Route) => string; parseRoute: (hash: string) => Route } {
  return { hashFor: (route) => hashFor(route, today), parseRoute: (hash) => parseRoute(hash, today) }
}
