import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import { Select } from 'household-ui/ui/Select.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import type { LogEntry, LogEntryEdit, LogStore } from './log-store.ts'
import { fromLocalInput, toLocalInput } from './local-datetime.ts'
import { isServings, servings as toServings } from './servings.ts'
import { useLeaveGuard } from './use-leave-guard.ts'

export interface LogEntryScreenProps {
  store: LogStore
  entry: LogEntry
  /** Called when the screen is done with the entry (after a delete) or the Member leaves it: back to the Day. */
  onDone: () => void
}

/** One logged entry: its snapshot name and totals read-only, with servings, Meal Type and eaten time editable. */
export function LogEntryScreen({ store, entry, onDone }: LogEntryScreenProps) {
  const initialServingsText = String(entry.servings)
  const initialEatenText = toLocalInput(entry.eatenAt)
  const [servingsText, setServingsText] = useState(initialServingsText)
  const [mealType, setMealType] = useState(entry.mealType)
  const [eatenText, setEatenText] = useState<string>(initialEatenText)
  const [error, setError] = useState<string | null>(null)

  const parsedServings = Number(servingsText)
  const parsedEatenAt = fromLocalInput(eatenText)
  const servingsValid = servingsText.trim() !== '' && isServings(parsedServings)

  const edit: LogEntryEdit = {
    ...(servingsValid && parsedServings !== entry.servings && { servings: toServings(parsedServings) }),
    ...(mealType !== entry.mealType && { mealType }),
    ...(parsedEatenAt && eatenText !== initialEatenText && { eatenAt: parsedEatenAt }),
  }
  // Dirty is keyed on the raw field text, so an invalid or cleared field still counts as unsaved.
  const dirty = servingsText !== initialServingsText || mealType !== entry.mealType || eatenText !== initialEatenText
  const canSave = servingsValid && parsedEatenAt !== undefined && Object.keys(edit).length > 0
  const { confirmLeave } = useLeaveGuard(dirty)

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    try {
      await store.update(entry.id, edit)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${entry.name}"?`)) return
    try {
      await store.softDelete(entry.id)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete.')
    }
  }

  const { kcal, proteinG, carbsG, fatG } = entry.nutrition
  return (
    <main class="screen log-entry">
      <Button variant="text" onClick={() => confirmLeave() && onDone()}>
        Back
      </Button>
      <h2>{entry.name}</h2>
      <dl class="totals">
        <dt>Calories</dt>
        <dd>{kcal} kcal</dd>
        <dt>Protein</dt>
        <dd>{proteinG} g</dd>
        <dt>Carbs</dt>
        <dd>{carbsG} g</dd>
        <dt>Fat</dt>
        <dd>{fatG} g</dd>
      </dl>
      <form class="stack" onSubmit={handleSubmit}>
        <TextField
          label="Servings"
          type="number"
          inputMode="decimal"
          step="any"
          value={servingsText}
          onInput={(event) => setServingsText(event.currentTarget.value)}
          error={servingsValid ? undefined : 'Servings must be a positive number.'}
        />
        <Select
          label="Meal type"
          value={mealType}
          onChange={(event) => setMealType(event.currentTarget.value as nutrition.MealType)}
        >
          {nutrition.MEAL_TYPES.map((type) => (
            <option value={type}>{type[0]!.toUpperCase() + type.slice(1)}</option>
          ))}
        </Select>
        <TextField
          label="Eaten at"
          type="datetime-local"
          value={eatenText}
          onInput={(event) => setEatenText(event.currentTarget.value)}
        />
        {error !== null && <p role="alert">{error}</p>}
        <Button type="submit" variant="filled" disabled={!canSave}>
          Save
        </Button>
      </form>
      <Button variant="text" destructive onClick={handleDelete}>
        Delete
      </Button>
    </main>
  )
}
