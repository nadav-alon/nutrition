import { useEffect, useState } from 'preact/hooks'
import type { Day } from './day.ts'
import { routesFor, type Route } from './routes.ts'

/**
 * The route the location hash names, how to go to another (a new history entry, so the browser's
 * back button returns to the previous screen and a refresh stays on this one), and how to finish
 * with a screen: `back` goes back to `route` when that is the entry just before, otherwise on to
 * it; `backToAny` goes back whenever the entry just before is a route `accepts`, otherwise on to
 * `fallback`. The last function swaps the current entry for another route instead of adding one,
 * for moves within a screen that back should not retrace.
 */
export function useRoute(
  today: Day,
): [
  Route,
  (route: Route) => void,
  (route: Route) => void,
  (fallback: Route, accepts: (from: Route) => boolean) => void,
  (route: Route) => void,
] {
  const { hashFor, parseRoute } = routesFor(today)
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    addEventListener('popstate', onChange)
    return () => {
      removeEventListener('hashchange', onChange)
      removeEventListener('popstate', onChange)
    }
  }, [])
  // A dated hash that names today (a bookmark, or a tab left open) is rewritten in place to the
  // bare `#/`, so reopening the app on a later day shows that day's Today, not this one.
  useEffect(() => {
    const route = parseRoute(hash)
    if (route.name === 'day' && route.day === today && hash !== '' && hash !== hashFor(route)) {
      history.replaceState(history.state, '', hashFor(route))
      setHash(location.hash)
    }
  }, [hash, today])
  const go = (route: Route) => {
    // The entry remembers the hash it was reached from, which is what `back` looks at.
    history.pushState({ from: location.hash }, '', hashFor(route))
    setHash(location.hash)
  }
  const backToAny = (fallback: Route, accepts: (from: Route) => boolean) => {
    const from = (history.state as { from?: string } | null)?.from
    if (from !== undefined && accepts(parseRoute(from))) history.back()
    else go(fallback)
  }
  // An empty hash reads as today's Day, so compare routes, not hash text.
  const back = (route: Route) => backToAny(route, (from) => hashFor(from) === hashFor(route))
  const replace = (route: Route) => {
    history.replaceState(history.state, '', hashFor(route))
    setHash(location.hash)
  }
  return [parseRoute(hash), go, back, backToAny, replace]
}
