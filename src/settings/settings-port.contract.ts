import { describe, expect, it } from 'vitest'
import { watchDeliveries } from '../test/watch-deliveries.ts'
import type { SettingsPort } from './settings-port.ts'

export function watchSwitch(port: SettingsPort) {
  return watchDeliveries<boolean>((onChange, onError) => port.watchGoogleHealthSync(onChange, onError))
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

    it('delivers nothing new when the switch is set to the value it already has', async () => {
      const port = await make()
      const watcher = watchSwitch(port)
      await watcher.until(1)
      await port.setGoogleHealthSync(true)
      await watcher.until(2)
      await port.setGoogleHealthSync(true)
      await port.setGoogleHealthSync(false)
      await watcher.until(3)
      watcher.stop()
      expect(watcher.seen).toEqual([false, true, false])
    })
  })
}
