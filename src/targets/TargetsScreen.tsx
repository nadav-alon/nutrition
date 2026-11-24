import { useEffect, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import type { Targets, TargetsPort } from './targets-port.ts'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'

type FieldKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
  { key: 'fatG', label: 'Fat (g)' },
]

type Draft = Record<FieldKey, string>
type Errors = Partial<Record<FieldKey, string>>

/** The message for each field holding something other than empty or a number above zero. */
function validate(draft: Draft): Errors {
  const errors: Errors = {}
  for (const { key } of FIELDS) {
    const text = draft[key].trim()
    if (text === '') continue
    const value = Number(text)
    if (!Number.isFinite(value)) errors[key] = 'Enter a number, or leave it empty for no Target.'
    else if (value <= 0) errors[key] = 'Must be above zero. Leave it empty for no Target.'
  }
  return errors
}

/** The Targets a validated draft stands for: an empty field is left out, so it is unset. */
function toTargets(draft: Draft): Targets {
  const targets: Targets = {}
  const kcal = draft.kcal.trim()
  const proteinG = draft.proteinG.trim()
  const carbsG = draft.carbsG.trim()
  const fatG = draft.fatG.trim()
  if (kcal !== '') targets.kcal = nutrition.kcal(Number(kcal))
  if (proteinG !== '') targets.proteinG = nutrition.grams(Number(proteinG))
  if (carbsG !== '') targets.carbsG = nutrition.grams(Number(carbsG))
  if (fatG !== '') targets.fatG = nutrition.grams(Number(fatG))
  return targets
}

const discardPrompt = 'Discard your unsaved changes?'

export type TargetsScreenProps = {
  port: TargetsPort
  /** Called when the Member leaves the screen; with unsaved changes, only once they agree to discard them. */
  onLeave: () => void
}

/** Sets the Member's daily Targets; a field left empty means no Target for that macro. */
export function TargetsScreen({ port, onLeave }: TargetsScreenProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  /** The fields as last loaded or saved, which unsaved changes are measured against. */
  const [saved, setSaved] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let first = true
    return port.subscribe(
      (targets) => {
        if (!first) return
        first = false
        const loaded = Object.fromEntries(FIELDS.map(({ key }) => [key, targets?.[key] === undefined ? '' : String(targets[key])])) as Draft
        setDraft(loaded)
        setSaved(loaded)
      },
      (error) => setLoadError(error.message),
    )
  }, [port])

  const dirty = draft !== null && saved !== null && FIELDS.some(({ key }) => draft[key] !== saved[key])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  if (loadError !== null) return <main class="screen targets" role="alert">{loadError}</main>
  if (draft === null) return <main class="screen targets" />

  function handleBack() {
    if (!dirty || confirm(discardPrompt)) onLeave()
  }

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    const found = validate(draft!)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaveError(null)
    try {
      await port.write(toTargets(draft!))
      setSaved(draft)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save your Targets.')
    }
  }

  return (
    <main class="screen targets">
      <Button variant="text" onClick={handleBack}>
        Back
      </Button>
      <form class="stack" noValidate onSubmit={handleSubmit}>
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            value={draft[key]}
            error={errors[key]}
            onInput={(event) => setDraft({ ...draft, [key]: event.currentTarget.value })}
          />
        ))}
        {saveError !== null && <p role="alert">{saveError}</p>}
        <Button type="submit" variant="filled">
          Save
        </Button>
      </form>
    </main>
  )
}
