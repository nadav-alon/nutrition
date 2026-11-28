import { useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { Button } from 'household-ui/ui/Button.tsx'
import { BackArrow } from '../BackArrow.tsx'
import { errorMessage } from '../error-message.ts'
import { rescaleNutrition } from '../log/rescale.ts'
import { servings as toServings } from '../log/servings.ts'
import { useConfirmFields } from './confirm-fields.tsx'
import { logPicked, type LogStepProps, type Picked } from './log-picked.ts'

export type { Picked }

export type ConfirmStepProps = LogStepProps & { picked: Picked }

const round = (value: number) => Math.round(value * 10) / 10

/** Confirms a picked Food or Recent: servings, Meal Type and eaten time, then logs it. */
export function ConfirmStep({ log, picked, day, now, onSaved, onBack }: ConfirmStepProps) {
  const { values, fields } = useConfirmFields(day, now)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eaten = values && rescaleNutrition(picked.perServing, toServings(1), values.servings)

  async function handleSubmit(event: JSX.TargetedEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!values || saving) return
    setSaving(true)
    setError(null)
    try {
      await logPicked(log, picked, values)
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Could not save.'))
      setSaving(false)
    }
  }

  return (
    <main class="screen log-confirm">
      <BackArrow onClick={onBack} />
      <h2>{picked.name}</h2>
      {picked.servingLabel !== undefined && <p>1 serving: {picked.servingLabel}</p>}
      {eaten !== undefined && (
        <p aria-label="Nutrition for these Servings">
          {round(eaten.kcal)} kcal · {round(eaten.proteinG)} g protein · {round(eaten.carbsG)} g carbs · {round(eaten.fatG)} g fat
        </p>
      )}
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
