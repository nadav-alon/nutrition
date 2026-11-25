import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { Day } from '../day.ts'
import { errorMessage } from '../error-message.ts'
import type { Foods } from '../foods/foods.ts'
import type { LogStore } from '../log/log-store.ts'
import { rescaleNutrition } from '../log/rescale.ts'
import { servings } from '../log/servings.ts'
import { useConfirmFields } from './confirm-fields.tsx'

type MacroKey = keyof nutrition.Nutrition

const MACROS: readonly { key: MacroKey; label: string; toValue: (value: number) => nutrition.Nutrition[MacroKey] }[] = [
  { key: 'kcal', label: 'Calories (kcal)', toValue: nutrition.kcal },
  { key: 'proteinG', label: 'Protein (g)', toValue: nutrition.grams },
  { key: 'carbsG', label: 'Carbs (g)', toValue: nutrition.grams },
  { key: 'fatG', label: 'Fat (g)', toValue: nutrition.grams },
]

/** The message for a macro's text, or undefined when it is a number of zero or more. */
function macroError(text: string): string | undefined {
  if (text.trim() === '') return 'Enter a number.'
  const value = Number(text)
  if (!Number.isFinite(value)) return 'Enter a number.'
  if (value < 0) return 'Must not be negative.'
  return undefined
}

export interface QuickEntryFormProps {
  log: LogStore
  foods: Foods
  day: Day
  now: Date
  /** Called once the entry is saved. */
  onSaved: () => void
  /** Called to go back to choosing. */
  onBack: () => void
}

/**
 * A name and per-Serving Nutrition typed once, with the confirm fields, logged as a Quick Entry; or,
 * with "Save as Food", saved as a Food first and logged as an entry of that Food.
 */
export function QuickEntryForm({ log, foods, day, now, onSaved, onBack }: QuickEntryFormProps) {
  const { values, fields } = useConfirmFields(day, now)
  const [name, setName] = useState('')
  const [macroText, setMacroText] = useState<Record<MacroKey, string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '' })
  const [saveAsFood, setSaveAsFood] = useState(false)
  const [place, setPlace] = useState('')
  const [servingLabel, setServingLabel] = useState('')
  const [estimated, setEstimated] = useState(false)
  /** The Food created by a save whose logging then failed, so a retry logs it rather than saving a second one. */
  const createdFood = useRef<nutrition.FoodId | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const nameError = trimmedName === '' ? 'Enter a name.' : undefined
  const macroErrors = Object.fromEntries(MACROS.map(({ key }) => [key, macroError(macroText[key])])) as Record<
    MacroKey,
    string | undefined
  >
  const valid = values !== undefined && nameError === undefined && MACROS.every(({ key }) => macroErrors[key] === undefined)

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || saving) return
    const perServing = Object.fromEntries(MACROS.map(({ key, toValue }) => [key, toValue(Number(macroText[key]))])) as unknown as nutrition.Nutrition
    setSaving(true)
    setError(null)
    try {
      let source: nutrition.LogEntrySource = { kind: 'quick' }
      if (saveAsFood) {
        createdFood.current ??= await foods.add({
          name: trimmedName,
          ...(place.trim() !== '' && { place: place.trim() }),
          ...(servingLabel.trim() !== '' && { servingLabel: servingLabel.trim() }),
          perServing,
          estimated,
        })
        source = { kind: 'food', foodId: createdFood.current }
      }
      await log.create({
        name: trimmedName,
        source,
        nutrition: rescaleNutrition(perServing, servings(1), values.servings),
        ...values,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen log-quick">
      <Button variant="text" onClick={onBack}>
        Back
      </Button>
      <h2>Quick entry</h2>
      <form class="stack" onSubmit={handleSubmit}>
        <TextField
          label="Name"
          value={name}
          onInput={(event) => setName(event.currentTarget.value)}
          error={nameError}
        />
        {MACROS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            step="any"
            value={macroText[key]}
            onInput={(event) => setMacroText({ ...macroText, [key]: event.currentTarget.value })}
            error={macroErrors[key]}
          />
        ))}
        <label>
          <input
            type="checkbox"
            checked={saveAsFood}
            onChange={(event) => setSaveAsFood(event.currentTarget.checked)}
          />{' '}
          Save as Food
        </label>
        {saveAsFood && (
          <>
            <TextField label="Place (optional)" value={place} onInput={(event) => setPlace(event.currentTarget.value)} />
            <TextField
              label="Serving label (optional)"
              value={servingLabel}
              onInput={(event) => setServingLabel(event.currentTarget.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={estimated}
                onChange={(event) => setEstimated(event.currentTarget.checked)}
              />{' '}
              Estimated
            </label>
          </>
        )}
        {fields}
        {error !== null && <p role="alert">{error}</p>}
        <Button type="submit" variant="filled" disabled={!valid || saving}>
          Save
        </Button>
      </form>
    </main>
  )
}
