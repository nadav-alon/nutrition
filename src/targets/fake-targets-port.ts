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
      current = targets
      for (const listener of listeners) listener(current)
    },
  }
}
