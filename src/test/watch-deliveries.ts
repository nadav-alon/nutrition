import { expect } from 'vitest'

const DELIVERY_POLL_MS = 10
const DELIVERY_TIMEOUT_MS = 2000

type Subscribe<T> = (onChange: (value: T) => void, onError: (error: Error) => void) => () => void

/** Collects what a port's subscription delivers, and waits for the next delivery. */
export function watchDeliveries<T>(subscribe: Subscribe<T>) {
  const seen: T[] = []
  const errors: Error[] = []
  const stop = subscribe((value) => seen.push(value), (error) => errors.push(error))
  return {
    seen,
    errors,
    stop,
    async until(count: number) {
      for (let waited = 0; waited < DELIVERY_TIMEOUT_MS && seen.length < count; waited += DELIVERY_POLL_MS) {
        await new Promise((r) => setTimeout(r, DELIVERY_POLL_MS))
      }
      expect(seen.length).toBeGreaterThanOrEqual(count)
    },
  }
}
