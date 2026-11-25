import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { errorMessage } from '../error-message.ts'
import type { FoodFields, Foods } from '../foods/foods.ts'

type MacroKey = keyof nutrition.Nutrition

const MACROS: readonly { key: MacroKey; label: string }[] = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
  { key: 'fatG', label: 'Fat (g)' },
]

type Errors = Partial<Record<'name' | MacroKey, string>>

export interface FoodFormProps {
  foods: Foods
  /** Called when the form is done: after a save, or when the Member backs out. */
  onDone: () => void
}

/** The form for a Food's fields: name, place, serving label, per-Serving Nutrition and whether it is Estimated. */
export function FoodForm({ foods, onDone }: FoodFormProps) {
  const [name, setName] = useState('')
  const [place, setPlace] = useState('')
  const [servingLabel, setServingLabel] = useState('')
  const [macros, setMacros] = useState<Record<MacroKey, string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '' })
  const [estimated, setEstimated] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /** The message for each field that cannot be saved, or the Food the fields stand for when all can. */
  function parse(): { errors: Errors } | { fields: FoodFields } {
    const found: Errors = {}
    if (name.trim() === '') found.name = 'Name is required.'
    const values: Partial<Record<MacroKey, number>> = {}
    for (const { key } of MACROS) {
      const text = macros[key].trim()
      const value = Number(text)
      if (text === '' || !Number.isFinite(value) || value < 0) found[key] = 'Enter a number, zero or more.'
      else values[key] = value
    }
    if (Object.keys(found).length > 0) return { errors: found }
    const perServing = {
      kcal: nutrition.kcal(values.kcal ?? 0),
      proteinG: nutrition.grams(values.proteinG ?? 0),
      carbsG: nutrition.grams(values.carbsG ?? 0),
      fatG: nutrition.grams(values.fatG ?? 0),
    }
    return {
      fields: {
        name: name.trim(),
        ...(place.trim() !== '' && { place: place.trim() }),
        ...(servingLabel.trim() !== '' && { servingLabel: servingLabel.trim() }),
        perServing,
        estimated,
      },
    }
  }

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const parsed = parse()
    if ('errors' in parsed) {
      setErrors(parsed.errors)
      return
    }
    setErrors({})
    setSaveError(null)
    setSaving(true)
    try {
      await foods.add(parsed.fields)
      onDone()
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen food-form">
      <Button variant="text" onClick={onDone}>
        Back
      </Button>
      <form class="stack" noValidate onSubmit={handleSubmit}>
        <TextField label="Name" value={name} error={errors.name} onInput={(event) => setName(event.currentTarget.value)} />
        <TextField label="Place" value={place} onInput={(event) => setPlace(event.currentTarget.value)} />
        <TextField label="Serving label" value={servingLabel} onInput={(event) => setServingLabel(event.currentTarget.value)} />
        {MACROS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            step="any"
            value={macros[key]}
            error={errors[key]}
            onInput={(event) => setMacros({ ...macros, [key]: event.currentTarget.value })}
          />
        ))}
        <label>
          <input type="checkbox" checked={estimated} onChange={(event) => setEstimated(event.currentTarget.checked)} /> Estimated
        </label>
        {saveError !== null && <p role="alert">{saveError}</p>}
        <Button type="submit" variant="filled" disabled={saving}>
          Save
        </Button>
      </form>
    </main>
  )
}
