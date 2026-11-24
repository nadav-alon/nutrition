import type { nutrition } from 'data-platform'

export type Targets = nutrition.Targets

/** Receives the Member's current Targets, or `null` when none are set. */
export type TargetsListener = (targets: Targets | null) => void

/**
 * The signed-in Member's **Targets**, read and written. Adapters are bound to one Member, so no
 * method takes a uid.
 */
export interface TargetsPort {
  /**
   * Calls `onChange` with the current Targets, then again on every change. `null` means the Member
   * has no Targets set; that is not an error. Returns the function that stops listening.
   */
  subscribe(onChange: TargetsListener, onError: (error: Error) => void): () => void
  /** Replaces the Member's Targets. A Target left out is unset, whatever it was before. */
  write(targets: Targets): Promise<void>
}
