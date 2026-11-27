import type { GoogleHealthSyncListener, SettingsPort } from './settings-port.ts'

/** An in-memory `SettingsPort`, starting with the switch off. */
export function fakeSettingsPort(): SettingsPort {
  let on = false
  const listeners = new Set<GoogleHealthSyncListener>()
  return {
    watchGoogleHealthSync(onChange) {
      listeners.add(onChange)
      onChange(on)
      return () => listeners.delete(onChange)
    },
    async setGoogleHealthSync(next) {
      on = next
      for (const listener of listeners) listener(on)
    },
  }
}
