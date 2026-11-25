import type { nutrition } from 'data-platform'
import type { Day } from '../day.ts'
import type { LogStore } from '../log/log-store.ts'
import { rescaleNutrition } from '../log/rescale.ts'
import { servings } from '../log/servings.ts'
import type { ConfirmValues } from './confirm-fields.tsx'

/** A thing chosen to log: what a Log Entry snapshots, with the Nutrition of one Serving. */
export interface Picked {
  readonly name: string
  readonly source: nutrition.LogEntrySource
  readonly perServing: nutrition.Nutrition
  readonly servingLabel?: string
}

/** What both steps after choosing take: where to log, and how to leave. */
export interface LogStepProps {
  log: LogStore
  day: Day
  now: Date
  /** Called once the entry is saved. */
  onSaved: () => void
  /** Called to go back to choosing. */
  onBack: () => void
}

/** Logs `picked` with the confirm values, its Nutrition scaled from one Serving to the servings eaten. */
export function logPicked(log: LogStore, picked: Picked, values: ConfirmValues): Promise<unknown> {
  return log.create({
    name: picked.name,
    source: picked.source,
    nutrition: rescaleNutrition(picked.perServing, servings(1), values.servings),
    ...values,
  })
}
