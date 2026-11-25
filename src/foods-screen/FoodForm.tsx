import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { errorMessage } from '../error-message.ts'
import { useLeaveGuard } from '../log/use-leave-guard.ts'
import type { FoodChanges, FoodFields, Foods, SavedFood } from '../foods/foods.ts'

type MacroKey = keyof nutrition.Nutrition

/** The four per-Serving macros: how each is labelled and how a number becomes its Nutrition value. */
const MACROS: readonly { key: MacroKey; label: string; toNutrition: (value: number) => number }[] = [
  { key: 'kcal', label: 'Calories (kcal)', toNutrition: nutrition.kcal },
  { key: 'proteinG', label: 'Protein (g)', toNutrition: nutrition.grams },
  { key: 'carbsG', label: 'Carbs (g)', toNutrition: nutrition.grams },
  { key: 'fatG', label: 'Fat (g)', toNutrition: nutrition.grams },
]

type Errors = Partial<Record<'name' | MacroKey, string>>
/** Macro fields whose input holds text the number field could not parse, which it reports as empty. */
type BadInput = Partial<Record<MacroKey, true>>

/** What the form's fields hold, as the text typed into them. */
interface Draft {
  name: string
  place: string
  servingLabel: string
  macros: Record<MacroKey, string>
  estimated: boolean
}

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
  const initial: Draft = {
    name: food?.name ?? '',
    place: food?.place ?? '',
    servingLabel: food?.servingLabel ?? '',
    macros: Object.fromEntries(MACROS.map(({ key }) => [key, food === undefined ? '' : String(food.perServing[key])])) as Record<MacroKey, string>,
    estimated: food?.estimated ?? false,
  }
  const [draft, setDraft] = useState<Draft>(initial)
  const [badInput, setBadInput] = useState<BadInput>({})
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dirty = Object.keys(badInput).length > 0 || JSON.stringify(draft) !== JSON.stringify(initial)
  const { confirmLeave } = useLeaveGuard(dirty)

  /** The message for each field that cannot be saved, or the Food the fields stand for when all can. */
  function parse(): { errors: Errors } | { fields: FoodFields } {
    const found: Errors = {}
    if (draft.name.trim() === '') found.name = 'Name is required.'
    for (const { key } of MACROS) {
      const text = draft.macros[key].trim()
      const value = Number(text)
      if (badInput[key] === true || text === '' || !Number.isFinite(value) || value < 0) found[key] = 'Enter a number, zero or more.'
    }
    if (Object.keys(found).length > 0) return { errors: found }
    const { place, servingLabel } = draft
    return {
      fields: {
        name: draft.name.trim(),
        ...(place.trim() !== '' && { place: place.trim() }),
        ...(servingLabel.trim() !== '' && { servingLabel: servingLabel.trim() }),
        // Every macro passed validation above, so each converts.
        perServing: Object.fromEntries(MACROS.map(({ key, toNutrition }) => [key, toNutrition(Number(draft.macros[key]))])) as unknown as nutrition.Nutrition,
        estimated: draft.estimated,
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
        <TextField label="Name" value={draft.name} error={errors.name} onInput={(event) => setDraft({ ...draft, name: event.currentTarget.value })} />
        <TextField label="Place" value={draft.place} onInput={(event) => setDraft({ ...draft, place: event.currentTarget.value })} />
        <TextField label="Serving label" value={draft.servingLabel} onInput={(event) => setDraft({ ...draft, servingLabel: event.currentTarget.value })} />
        {MACROS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            step="any"
            value={draft.macros[key]}
            error={errors[key]}
            onInput={(event) => {
              const { value, validity } = event.currentTarget
              setBadInput((previous) => {
                const next = { ...previous }
                if (value === '' && validity.badInput) next[key] = true
                else delete next[key]
                return next
              })
              setDraft({ ...draft, macros: { ...draft.macros, [key]: value } })
            }}
          />
        ))}
        <label>
          <input type="checkbox" checked={draft.estimated} onChange={(event) => setDraft({ ...draft, estimated: event.currentTarget.checked })} /> Estimated
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
