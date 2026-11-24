import { useMemo, useState } from 'preact/hooks'
import { initFirebase, saveFirebaseWebConfig, type FirebaseWebConfig, type LocalKit } from 'data-platform/client'
import { AuthGate } from './gate/AuthGate.tsx'
import { resolveConfig, type ConfigResolution } from './gate/config.ts'
import { emulatorConfig, emulatorKit } from './gate/emulator.ts'
import { PlatformGuard } from './gate/PlatformGuard.tsx'
import { SetupScreen } from './gate/SetupScreen.tsx'
import { App } from './App.tsx'
import { APP_NAME } from './app-name.ts'
import { AlertBanner } from 'household-ui/ui/AlertBanner.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { CentredCard } from 'household-ui/ui/CentredCard.tsx'

type RootState = Pick<ConfigResolution, 'config' | 'error' | 'proposed'>

/** Resolves the config once, before first paint, and strips a consumed `#config=` fragment. */
function initialState(): RootState {
  const emulator = emulatorConfig()
  if (emulator !== null) return { config: emulator, error: null, proposed: null }
  const { config, error, proposed, consumed } = resolveConfig(location.hash)
  if (consumed) history.replaceState(null, '', location.pathname + location.search)
  return { config, error, proposed }
}

/** The app's entry: config, then sign-in and membership, then the app. */
export function Root() {
  const [{ config, error, proposed }, setState] = useState(initialState)
  const kit = emulatorKit()
  /** Moves on with `next` as the config, with no error and no link left to answer. */
  const settle = (next: FirebaseWebConfig | null) => setState({ config: next, error: null, proposed: null })

  if (proposed !== null) {
    return (
      <CentredCard appName={APP_NAME} title="Switch Household?">
        <p>
          This link carries the config of another Firebase project (<code>{proposed.projectId}</code>). Accepting it
          also repoints the Catalogue on this device.
        </p>
        <Button
          variant="filled"
          onClick={() => {
            saveFirebaseWebConfig(proposed)
            settle(proposed)
          }}
        >
          Switch to {proposed.projectId}
        </Button>
        <Button variant="tonal" onClick={() => settle(config)}>
          Keep the current Household
        </Button>
      </CentredCard>
    )
  }

  if (config === null) {
    return (
      <SetupScreen
        initialError={error}
        onConfigured={(next) => {
          saveFirebaseWebConfig(next)
          settle(next)
        }}
      />
    )
  }
  return (
    <>
      {error !== null && (
        <AlertBanner
          message={`${error} The link was ignored.`}
          onDismiss={() => settle(config)}
        />
      )}
      <Connected config={config} kit={kit} />
    </>
  )
}

function Connected({ config, kit }: { config: FirebaseWebConfig; kit: LocalKit | undefined }) {
  const client = useMemo(() => initFirebase(config, { local: kit }), [config, kit])
  return (
    <AuthGate client={client}>
      <PlatformGuard db={client.db} />
      <App />
    </AuthGate>
  )
}
