import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { nutrition } from 'data-platform'
import { Button } from 'household-ui/ui/Button.tsx'
import type { Day } from '../day.ts'
import { errorMessage } from '../error-message.ts'
import type { LogStore } from '../log/log-store.ts'
import { rescaleNutrition } from '../log/rescale.ts'
import { servings } from '../log/servings.ts'
import { useConfirmFields } from './confirm-fields.tsx'

/** A thing chosen to log: what a Log Entry snapshots, with the Nutrition of one Serving. */
export interface Picked {
  readonly name: string
  readonly source: nutrition.LogEntrySource
  readonly perServing: nutrition.Nutrition
  readonly servingLabel?: string
}

export interface ConfirmStepProps {
  log: LogStore
  picked: Picked
  day: Day
  now: Date
  /** Called once the entry is saved. */
  onSaved: () => void
  /** Called to go back to choosing. */
  onBack: () => void
}

/** Confirms a picked Food or Recent: servings, Meal Type and eaten time, then logs it. */
export function ConfirmStep({ log, picked, day, now, onSaved, onBack }: ConfirmStepProps) {
  const { values, fields } = useConfirmFields(day, now)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!values || saving) return
    setSaving(true)
    setError(null)
    try {
      await log.create({
        name: picked.name,
        source: picked.source,
        nutrition: rescaleNutrition(picked.perServing, servings(1), values.servings),
        ...values,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen log-confirm">
      <Button variant="text" onClick={onBack}>
        Back
      </Button>
      <h2>{picked.name}</h2>
      {picked.servingLabel !== undefined && <p>1 serving: {picked.servingLabel}</p>}
      <form class="stack" onSubmit={handleSubmit}>
        {fields}
        {error !== null && <p role="alert">{error}</p>}
        <Button type="submit" variant="filled" disabled={!values || saving}>
          Save
        </Button>
      </form>
    </main>
  )
}
