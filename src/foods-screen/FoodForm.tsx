import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { errorMessage } from '../error-message.ts'
import { useLeaveGuard } from '../log/use-leave-guard.ts'
import type { FoodChanges, FoodFields, Foods, SavedFood } from '../foods/foods.ts'

type MacroKey = keyof nutrition.Nutrition

const MACROS: readonly { key: MacroKey; label: string }[] = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
  { key: 'fatG', label: 'Fat (g)' },
]

type Errors = Partial<Record<'name' | MacroKey, string>>

/** The changes that make a Food read as `fields`: a place or serving label left out is cleared. */
function toChanges({ place, servingLabel, ...rest }: FoodFields): FoodChanges {
  return { ...rest, place: place ?? null, servingLabel: servingLabel ?? null }
}

export interface FoodFormProps {
  foods: Foods
  /** The Food being edited; without one the form adds a new Food. */
  food?: SavedFood
  /** Called when the form is done: after a save or delete, or when the Member backs out, which with unsaved changes needs their agreement to discard them. */
  onDone: () => void
}

/** The form for a Food's fields: name, place, serving label, per-Serving Nutrition and whether it is Estimated. */
export function FoodForm({ foods, food, onDone }: FoodFormProps) {
  /** The fields as loaded, which unsaved changes are measured against. */
  const initial: { name: string; place: string; servingLabel: string; macros: Record<MacroKey, string>; estimated: boolean } = {
    name: food?.name ?? '',
    place: food?.place ?? '',
    servingLabel: food?.servingLabel ?? '',
    macros: {
      kcal: food === undefined ? '' : String(food.perServing.kcal),
      proteinG: food === undefined ? '' : String(food.perServing.proteinG),
      carbsG: food === undefined ? '' : String(food.perServing.carbsG),
      fatG: food === undefined ? '' : String(food.perServing.fatG),
    },
    estimated: food?.estimated ?? false,
  }
  const [name, setName] = useState(initial.name)
  const [place, setPlace] = useState(initial.place)
  const [servingLabel, setServingLabel] = useState(initial.servingLabel)
  const [macros, setMacros] = useState<Record<MacroKey, string>>(initial.macros)
  const [estimated, setEstimated] = useState(initial.estimated)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dirty =
    name !== initial.name ||
    place !== initial.place ||
    servingLabel !== initial.servingLabel ||
    estimated !== initial.estimated ||
    MACROS.some(({ key }) => macros[key] !== initial.macros[key])
  const { confirmLeave } = useLeaveGuard(dirty)

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

  async function handleDelete() {
    if (saving || food === undefined || !confirm(`Delete "${food.name}"?`)) return
    setSaveError(null)
    setSaving(true)
    try {
      await foods.softDelete(food.id)
      onDone()
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not delete.'))
      setSaving(false)
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
      if (food === undefined) await foods.add(parsed.fields)
      else await foods.edit(food.id, toChanges(parsed.fields))
      onDone()
    } catch (error) {
      setSaveError(errorMessage(error, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen food-form">
      <Button variant="text" onClick={() => confirmLeave() && onDone()}>
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
      {food !== undefined && (
        <Button variant="text" destructive disabled={saving} onClick={handleDelete}>
          Delete
        </Button>
      )}
    </main>
  )
}
