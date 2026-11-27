import { useEffect, useState } from 'preact/hooks'
import type { Day } from './day.ts'
import { hashFor, parseRoute, type Route } from './routes.ts'

/**
 * The route the location hash names, how to go to another (a new history entry, so the browser's
 * back button returns to the previous screen and a refresh stays on this one), and how to finish
 * with a screen: back to `route` when that is the entry just before, otherwise on to it.
 */
export function useRoute(today: Day): [Route, (route: Route) => void, (route: Route) => void] {
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
    const route = parseRoute(hash, today)
    if (route.name === 'day' && route.day === today && hash !== '' && hash !== hashFor(route, today)) {
      history.replaceState(history.state, '', hashFor(route, today))
      setHash(location.hash)
    }
  }, [hash, today])
  const go = (route: Route) => {
    // The entry remembers the hash it was reached from, which is what `back` looks at.
    history.pushState({ from: location.hash }, '', hashFor(route, today))
    setHash(location.hash)
  }
  const back = (route: Route) => {
    const from = (history.state as { from?: string } | null)?.from
    // An empty hash reads as today's Day, so compare routes, not hash text.
    if (from !== undefined && hashFor(parseRoute(from, today), today) === hashFor(route, today)) history.back()
    else go(route)
  }
  return [parseRoute(hash, today), go, back]
}
