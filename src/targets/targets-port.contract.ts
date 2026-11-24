import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
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

    it('delivers Targets as they are written, live', async () => {
      const port = await make()
      const watcher = watch(port)
      await watcher.until(1)
      const first = { kcal: nutrition.kcal(2000), proteinG: nutrition.grams(150) }
      const second = { kcal: nutrition.kcal(1800), proteinG: nutrition.grams(150), fatG: nutrition.grams(60) }
      await port.write(first)
      await watcher.until(2)
      await port.write(second)
      await watcher.until(3)
      watcher.stop()
      expect(watcher.seen).toEqual([null, first, second])
    })

    it('reads each of kcal, protein, carbs and fat as unset when written without it', async () => {
      const port = await make()
      const watcher = watch(port)
      await watcher.until(1)
      await port.write({ kcal: nutrition.kcal(2000), proteinG: nutrition.grams(150), carbsG: nutrition.grams(200), fatG: nutrition.grams(60) })
      await watcher.until(2)
      await port.write({ carbsG: nutrition.grams(200) })
      await watcher.until(3)
      watcher.stop()
      expect(watcher.seen.at(-1)).toEqual({ carbsG: 200 })
      await port.write({})
      const later = watch(port)
      await later.until(1)
      later.stop()
      expect(later.seen).toEqual([{}])
    })
  })
}
