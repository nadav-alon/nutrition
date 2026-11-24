import type { Targets, TargetsListener, TargetsPort } from './targets-port.ts'

/** An in-memory `TargetsPort`, starting with no Targets set. */
export function fakeTargetsPort(): TargetsPort {
  let current: Targets | null = null
  const listeners = new Set<TargetsListener>()
  return {
    subscribe(onChange) {
      listeners.add(onChange)
      onChange(current)
      return () => listeners.delete(onChange)
    },
    async write(targets) {
      // A copy without undefined values, as the Firestore adapter stores and delivers.
      current = Object.fromEntries(Object.entries(targets).filter(([, value]) => value !== undefined)) as Targets
      for (const listener of listeners) listener(current)
    },
  }
}
