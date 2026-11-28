/** Receives whether the Member's Google Health switch is on. */
export type GoogleHealthSyncListener = (on: boolean) => void

/**
 * The signed-in Member's **Nutrition Settings**, read and written. Adapters are bound to one Member,
 * so no method takes a uid.
 */
export interface SettingsPort {
  /**
   * Calls `onChange` with the current state of the Member's Google Health switch, then again on every
   * change. The switch is off when the Member has no settings document or the document lacks the
   * field; that is not an error. Returns the function that stops listening.
   */
  watchGoogleHealthSync(onChange: GoogleHealthSyncListener, onError: (error: Error) => void): () => void
  /** Turns the Member's Google Health switch on or off. */
  setGoogleHealthSync(on: boolean): Promise<void>
}
