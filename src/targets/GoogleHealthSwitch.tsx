import { useEffect, useId, useState } from 'preact/hooks'
import type { SettingsPort } from '../settings/settings-port.ts'

/**
 * The Member's Push to Google Health switch, read from and written to the settings port at once.
 * It renders nothing until the port first reports, so a tap never acts on a guessed state.
 */
export function GoogleHealthSwitch({ settings }: { settings: SettingsPort }) {
  const noteId = useId()
  const [pushOn, setPushOn] = useState<boolean | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)

  useEffect(() => {
    return settings.watchGoogleHealthSync(
      (on) => {
        setPushError(null)
        setPushOn(on)
      },
      (error) => setPushError(error.message),
    )
  }, [settings])

  async function handleToggle(on: boolean) {
    setPushError(null)
    try {
      await settings.setGoogleHealthSync(on)
    } catch (error) {
      setPushError(error instanceof Error ? error.message : 'Could not save the Google Health switch.')
    }
  }

  return (
    <div class="stack">
      {pushOn !== null && (
        <>
          <label>
            <input
              type="checkbox"
              role="switch"
              checked={pushOn}
              aria-describedby={noteId}
              onChange={(event) => {
                // The checkbox follows the port, not the click, so a failed write leaves it as it was.
                event.currentTarget.checked = pushOn
                void handleToggle(!pushOn)
              }}
            />{' '}
            Push to Google Health
          </label>
          <p id={noteId}>Pushing needs a Google account linked in the Google Health app.</p>
        </>
      )}
      {pushError !== null && <p role="alert">{pushError}</p>}
    </div>
  )
}
