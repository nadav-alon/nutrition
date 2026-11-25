import { useEffect, useState } from 'preact/hooks'
import type { Day } from './day.ts'
import { hashFor, parseRoute, type Route } from './routes.ts'

/**
 * The route the location hash names, and how to go to another: a new history entry, so the browser's
 * back button returns to the previous screen and a refresh stays on this one.
 */
export function useRoute(today: Day): [Route, (route: Route) => void] {
  const [hash, setHash] = useState(() => location.hash)
  useEffect(() => {
    const onChange = () => setHash(location.hash)
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  const go = (route: Route) => {
    location.hash = hashFor(route)
    // The hashchange event arrives a tick later; reading the hash now keeps the screen in step with the URL.
    setHash(location.hash)
  }
  return [parseRoute(hash, today), go]
}
