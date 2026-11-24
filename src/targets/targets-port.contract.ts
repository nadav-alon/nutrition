import { describe, expect, it } from 'vitest'
import type { Targets, TargetsPort } from './targets-port.ts'

/** Collects what a port's subscription delivers, and waits for the next delivery. */
function watch(port: TargetsPort) {
  const seen: (Targets | null)[] = []
  const errors: Error[] = []
  const stop = port.subscribe((targets) => seen.push(targets), (error) => errors.push(error))
  return {
    seen,
    errors,
    stop,
    async until(count: number) {
      for (let i = 0; i < 200 && seen.length < count; i++) await new Promise((r) => setTimeout(r, 10))
      expect(seen.length).toBeGreaterThanOrEqual(count)
    },
  }
}

/** The behaviour every `TargetsPort` shares; `make` returns a port for a Member with no Targets document. */
export function targetsPortContract(name: string, make: () => Promise<TargetsPort>) {
  describe(`${name} as a TargetsPort`, () => {
    it('reads a Member with no Targets document as no Targets set', async () => {
      const watcher = watch(await make())
      await watcher.until(1)
      watcher.stop()
      expect(watcher.seen).toEqual([null])
      expect(watcher.errors).toEqual([])
    })
  })
}
