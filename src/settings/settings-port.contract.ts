import { describe, expect, it } from 'vitest'
import type { SettingsPort } from './settings-port.ts'

const DELIVERY_POLL_MS = 10
const DELIVERY_TIMEOUT_MS = 2000

/** Collects what a port's watch delivers, and waits for the next delivery. */
export function watchSwitch(port: SettingsPort) {
  const seen: boolean[] = []
  const errors: Error[] = []
  const stop = port.watchGoogleHealthSync((on) => seen.push(on), (error) => errors.push(error))
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

/** The behaviour every `SettingsPort` shares; `make` returns a port for a Member with no settings document. */
export function settingsPortContract(name: string, make: () => Promise<SettingsPort>) {
  describe(`${name} as a SettingsPort`, () => {
    it('reads a Member with no settings document as the switch off', async () => {
      const watcher = watchSwitch(await make())
      await watcher.until(1)
      watcher.stop()
      expect(watcher.seen).toEqual([false])
      expect(watcher.errors).toEqual([])
    })

    it('delivers the switch as it is turned on and off, live', async () => {
      const port = await make()
      const watcher = watchSwitch(port)
      await watcher.until(1)
      await port.setGoogleHealthSync(true)
      await watcher.until(2)
      await port.setGoogleHealthSync(false)
      await watcher.until(3)
      watcher.stop()
      expect(watcher.seen).toEqual([false, true, false])
    })

    it('reads the switch a later watcher finds as it was last set', async () => {
      const port = await make()
      await port.setGoogleHealthSync(true)
      const on = watchSwitch(port)
      await on.until(1)
      on.stop()
      expect(on.seen).toEqual([true])
      await port.setGoogleHealthSync(false)
      const off = watchSwitch(port)
      await off.until(1)
      off.stop()
      expect(off.seen).toEqual([false])
    })
  })
}
