import { useEffect, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { TargetsPort } from './targets-port.ts'
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

export type TargetsScreenProps = {
  port: TargetsPort
}

/** Sets the Member's daily Targets; a field left empty means no Target for that macro. */
export function TargetsScreen({ port }: TargetsScreenProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let first = true
    return port.subscribe(
      (targets) => {
        if (!first) return
        first = false
        setDraft(Object.fromEntries(FIELDS.map(({ key }) => [key, targets?.[key] === undefined ? '' : String(targets[key])])) as Draft)
      },
      (error) => setLoadError(error.message),
    )
  }, [port])

  if (loadError !== null) return <main class="screen targets" role="alert">{loadError}</main>
  if (draft === null) return <main class="screen targets" />

  function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrors(validate(draft!))
  }

  return (
    <main class="screen targets">
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
        <Button type="submit" variant="filled">
          Save
        </Button>
      </form>
    </main>
  )
}
