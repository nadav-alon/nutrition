import { useEffect, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import type { SettingsPort } from '../settings/settings-port.ts'
import type { Targets, TargetsPort } from './targets-port.ts'
import { GoogleHealthSwitch } from './GoogleHealthSwitch.tsx'
import { Button } from 'household-ui/ui/Button.tsx'
import { BackArrow } from '../BackArrow.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'

type FieldKey = Extract<'kcal' | 'proteinG' | 'carbsG' | 'fatG', keyof Targets>

const FIELDS: { key: FieldKey; label: string; toTarget: (value: number) => Targets[FieldKey] }[] = [
  { key: 'kcal', label: 'Calories (kcal)', toTarget: nutrition.kcal },
  { key: 'proteinG', label: 'Protein (g)', toTarget: nutrition.grams },
  { key: 'carbsG', label: 'Carbs (g)', toTarget: nutrition.grams },
  { key: 'fatG', label: 'Fat (g)', toTarget: nutrition.grams },
]

type Draft = Record<FieldKey, string>
type Errors = Partial<Record<FieldKey, string>>
/** Fields whose input holds text the number field could not parse, which it reports as empty. */
type BadInput = Partial<Record<FieldKey, true>>

const notANumber = 'Enter a number, or leave it empty for no Target.'

/** The message for each field holding something other than empty or a number above zero. */
function validate(draft: Draft, badInput: BadInput): Errors {
  const errors: Errors = {}
  for (const { key } of FIELDS) {
    if (badInput[key] === true) {
      errors[key] = notANumber
      continue
    }
    const text = draft[key].trim()
    if (text === '') continue
    const value = Number(text)
    if (!Number.isFinite(value)) errors[key] = notANumber
    else if (value <= 0) errors[key] = 'Must be above zero. Leave it empty for no Target.'
  }
  return errors
}

/** The Targets a validated draft stands for: an empty field is left out, so it is unset. */
function toTargets(draft: Draft): Targets {
  const targets: Targets = {}
  for (const { key, toTarget } of FIELDS) {
    const text = draft[key].trim()
    if (text !== '') (targets as Record<FieldKey, unknown>)[key] = toTarget(Number(text))
  }
  return targets
}

const discardPrompt = 'Discard your unsaved changes?'

export type TargetsScreenProps = {
  targets: TargetsPort
  /** Where the Push to Google Health switch is read and written; it applies at once, apart from the Targets form. */
  settings: SettingsPort
  /** Called when the Member leaves the screen; with unsaved changes, only once they agree to discard them. */
  onLeave: () => void
}

/**
 * Sets the Member's daily Targets; a field left empty means no Target for that macro. Also hosts the
 * Push to Google Health switch.
 */
export function TargetsScreen({ targets: port, settings, onLeave }: TargetsScreenProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The fields as last loaded or saved, which unsaved changes are measured against. */
  const [saved, setSaved] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [badInput, setBadInput] = useState<BadInput>({})
  const [saving, setSaving] = useState(false)
  const [portError, setPortError] = useState<string | null>(null)

  const hasBadInput = FIELDS.some(({ key }) => badInput[key] === true)
  const dirty = hasBadInput || (draft !== null && saved !== null && FIELDS.some(({ key }) => draft[key] !== saved[key]))
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  useEffect(() => {
    return port.subscribe(
      (targets) => {
        setPortError(null)
        // Unsaved edits win over a change made elsewhere; a form with none follows the port.
        if (dirtyRef.current) return
        const loaded = Object.fromEntries(FIELDS.map(({ key }) => [key, targets?.[key] === undefined ? '' : String(targets[key])])) as Draft
        setDraft(loaded)
        setSaved(loaded)
      },
      (error) => setPortError(error.message),
    )
  }, [port])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (draft === null) {
    return portError !== null ? (
      <main class="screen targets" role="alert">
        <BackArrow onClick={onLeave} />
        {portError}
      </main>
    ) : (
      <main class="screen targets">
        <BackArrow onClick={onLeave} />
        <p>Loading…</p>
      </main>
    )
  }
  const current = draft

  function handleBack() {
    if (!dirty || confirm(discardPrompt)) onLeave()
  }

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const found = validate(current, badInput)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaveError(null)
    setSaving(true)
    try {
      await port.write(toTargets(current))
      setSaved(current)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your Targets.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main class="screen targets">
      <BackArrow onClick={handleBack} />
      <form class="stack" noValidate onSubmit={handleSubmit}>
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            value={draft[key]}
            error={errors[key]}
            onInput={(event) => {
              const { value, validity } = event.currentTarget
              setBadInput((previous) => {
                const next = { ...previous }
                if (value === '' && validity.badInput) next[key] = true
                else delete next[key]
                return next
              })
              setDraft({ ...current, [key]: value })
            }}
          />
        ))}
        {saveError !== null && <p role="alert">{saveError}</p>}
        {portError !== null && <p role="alert">{portError}</p>}
        <Button type="submit" variant="filled" disabled={saving}>
          Save
        </Button>
      </form>
      <GoogleHealthSwitch settings={settings} />
    </main>
  )
}
