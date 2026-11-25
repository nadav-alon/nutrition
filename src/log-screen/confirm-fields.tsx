import { useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { nutrition } from 'data-platform'
import { Select } from 'household-ui/ui/Select.tsx'
import { TextField } from 'household-ui/ui/TextField.tsx'
import { defaultEatenTime, type Day } from '../day.ts'
import { fromLocalInput, toLocalInput } from '../log/local-datetime.ts'
import { isMealType, mealTypeLabel } from '../log/meal-type-label.ts'
import { isServings, servings as toServings, type Servings } from '../log/servings.ts'
import { guessMealType } from '../meal-type.ts'

/** What the confirm fields settle on once valid: how much, which Meal Type, and when. */
export interface ConfirmValues {
  servings: Servings
  mealType: nutrition.MealType
  eatenAt: Date
}

/**
 * The fields shared by logging a Food, a Recent and a Quick Entry: servings (default 1, fractions
 * allowed), Meal Type, and eaten time. The eaten time starts at the Day module's default; the Meal
 * Type follows the eaten time until the Member picks one themselves. `values` is undefined while
 * any field is invalid, and `fields` shows the message for each. `initialServings` is the text the
 * servings field starts with.
 */
export function useConfirmFields(day: Day, now: Date, initialServings = '1'): { values: ConfirmValues | undefined; fields: ComponentChildren } {
  const [servingsText, setServingsText] = useState(initialServings)
  const [eatenText, setEatenText] = useState<string>(() => toLocalInput(defaultEatenTime(day, now)))
  const [pickedMealType, setPickedMealType] = useState<nutrition.MealType | null>(null)

  const parsedServings = Number(servingsText)
  const servingsValid = servingsText.trim() !== '' && isServings(parsedServings)
  const eatenAt = fromLocalInput(eatenText)
  const mealType = pickedMealType ?? (eatenAt ? guessMealType(eatenAt) : 'snack')

  const values =
    servingsValid && eatenAt ? { servings: toServings(parsedServings), mealType, eatenAt } : undefined
  const fields = (
    <>
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
        onChange={(event) => {
          const { value } = event.currentTarget
          if (isMealType(value)) setPickedMealType(value)
        }}
      >
        {nutrition.MEAL_TYPES.map((type) => (
          <option value={type}>{mealTypeLabel(type)}</option>
        ))}
      </Select>
      <TextField
        label="Eaten at"
        type="datetime-local"
        value={eatenText}
        onInput={(event) => setEatenText(event.currentTarget.value)}
        error={eatenAt ? undefined : 'Enter the time you ate it.'}
      />
    </>
  )
  return { values, fields }
}
