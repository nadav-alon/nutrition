import { useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { EstimateLink } from '../estimate-link.ts'
import { BackArrow } from '../BackArrow.tsx'
import { errorMessage } from '../error-message.ts'
import type { FoodFields, Foods } from '../foods/foods.ts'
import { useConfirmFields } from './confirm-fields.tsx'
import { logPicked, type LogStepProps } from './log-picked.ts'

type MacroKey = keyof nutrition.Nutrition

const MACROS: readonly { key: MacroKey; label: string }[] = [
  { key: 'kcal', label: 'Calories (kcal)' },
  { key: 'proteinG', label: 'Protein (g)' },
  { key: 'carbsG', label: 'Carbs (g)' },
  { key: 'fatG', label: 'Fat (g)' },
]

type MacroText = Record<MacroKey, string>

/** The message for a macro's text, or undefined when it is a number of zero or more. */
function macroError(text: string): string | undefined {
  if (text.trim() === '') return 'Enter a number.'
  const value = Number(text)
  if (!Number.isFinite(value)) return 'Enter a number.'
  if (value < 0) return 'Must not be negative.'
  return undefined
}

/** The per-Serving Nutrition the macro texts hold; only call it once every text is valid. */
function toNutrition(text: MacroText): nutrition.Nutrition {
  return {
    kcal: nutrition.kcal(Number(text.kcal)),
    proteinG: nutrition.grams(Number(text.proteinG)),
    carbsG: nutrition.grams(Number(text.carbsG)),
    fatG: nutrition.grams(Number(text.fatG)),
  }
}

export type QuickEntryFormProps = LogStepProps & {
  foods: Foods
  /** An estimate to start the form from; "Save as Food" then starts ticked. */
  estimate?: EstimateLink
}

/**
 * A name and per-Serving Nutrition typed once, with the confirm fields, logged as a Quick Entry; or,
 * with "Save as Food", saved as a Food first and logged as an entry of that Food.
 */
export function QuickEntryForm({ log, foods, day, now, estimate, onSaved, onBack }: QuickEntryFormProps) {
  const { values, fields } = useConfirmFields(day, now, estimate?.servings)
  const [name, setName] = useState(estimate?.name ?? '')
  const [macroText, setMacroText] = useState<MacroText>({
    kcal: estimate?.kcal ?? '',
    proteinG: estimate?.proteinG ?? '',
    carbsG: estimate?.carbsG ?? '',
    fatG: estimate?.fatG ?? '',
  })
  const [saveAsFood, setSaveAsFood] = useState(estimate !== undefined)
  const [place, setPlace] = useState(estimate?.place ?? '')
  const [servingLabel, setServingLabel] = useState('')
  const [estimated, setEstimated] = useState(estimate?.estimated ?? false)
  /** The Food created by a save whose logging then failed, with the fields it was saved with, so a retry brings it up to date rather than saving a second one. */
  const createdFood = useRef<{ id: nutrition.FoodId; fields: FoodFields } | null>(null)
  /** The fields the Member has typed in, whose messages show; the rest stay quiet until they do. */
  const [touched, setTouched] = useState<ReadonlySet<'name' | MacroKey>>(new Set())
  const touch = (field: 'name' | MacroKey) => setTouched((previous) => new Set(previous).add(field))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const nameError = trimmedName === '' ? 'Enter a name.' : undefined
  const macroErrors: Record<MacroKey, string | undefined> = {
    kcal: macroError(macroText.kcal),
    proteinG: macroError(macroText.proteinG),
    carbsG: macroError(macroText.carbsG),
    fatG: macroError(macroText.fatG),
  }
  const valid = values !== undefined && nameError === undefined && MACROS.every(({ key }) => macroErrors[key] === undefined)

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || saving) return
    const perServing = toNutrition(macroText)
    setSaving(true)
    setError(null)
    try {
      let source: nutrition.LogEntrySource = { kind: 'quick' }
      if (saveAsFood) {
        const foodFields: FoodFields = {
          name: trimmedName,
          ...(place.trim() !== '' && { place: place.trim() }),
          ...(servingLabel.trim() !== '' && { servingLabel: servingLabel.trim() }),
          perServing,
          estimated,
        }
        const created = createdFood.current
        let foodId: nutrition.FoodId
        if (created === null) {
          foodId = await foods.add(foodFields)
          createdFood.current = { id: foodId, fields: foodFields }
        } else {
          foodId = created.id
          if (JSON.stringify(created.fields) !== JSON.stringify(foodFields)) {
            await foods.edit(foodId, {
              ...foodFields,
              place: foodFields.place ?? null,
              servingLabel: foodFields.servingLabel ?? null,
            })
            createdFood.current = { id: foodId, fields: foodFields }
          }
        }
        source = { kind: 'food', foodId }
      } else if (createdFood.current !== null) {
        // A first attempt saved a Food that the Member has since opted out of: drop it, so it is not left behind unlogged.
        await foods.softDelete(createdFood.current.id)
        createdFood.current = null
      }
      await logPicked(log, { name: trimmedName, source, perServing, ...(!saveAsFood && estimated && { estimated: true as const }) }, values)
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen log-quick">
      <BackArrow onClick={onBack} />
      <h2>Quick entry</h2>
      <form class="stack" onSubmit={handleSubmit}>
        <TextField
          label="Name"
          value={name}
          onInput={(event) => {
            touch('name')
            setName(event.currentTarget.value)
          }}
          error={touched.has('name') ? nameError : undefined}
        />
        {MACROS.map(({ key, label }) => (
          <TextField
            key={key}
            label={label}
            type="number"
            inputMode="decimal"
            step="any"
            value={macroText[key]}
            onInput={(event) => {
              touch(key)
              setMacroText({ ...macroText, [key]: event.currentTarget.value })
            }}
            error={touched.has(key) ? macroErrors[key] : undefined}
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
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={estimated}
            onChange={(event) => setEstimated(event.currentTarget.checked)}
          />{' '}
          Estimated
        </label>
        {fields}
        {error !== null && <p role="alert">{error}</p>}
        <Button type="submit" variant="filled" disabled={!valid || saving}>
          Save
        </Button>
      </form>
    </main>
  )
}
