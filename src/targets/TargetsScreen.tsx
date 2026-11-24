import { useEffect, useState } from 'preact/hooks'
import type { TargetsPort } from './targets-port.ts'
import { TextField } from 'household-ui/ui/TextField.tsx'

type FieldKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG'

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
  { key: 'fatG', label: 'Fat (g)' },
]

type Draft = Record<FieldKey, string>

export type TargetsScreenProps = {
  port: TargetsPort
}

/** Sets the Member's daily Targets; a field left empty means no Target for that macro. */
export function TargetsScreen({ port }: TargetsScreenProps) {
  const [draft, setDraft] = useState<Draft | null>(null)
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

  return (
    <main class="screen targets">
      <form class="stack">
        {FIELDS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            value={draft[key]}
            onInput={(event) => setDraft({ ...draft, [key]: event.currentTarget.value })}
          />
        ))}
      </form>
    </main>
  )
}
