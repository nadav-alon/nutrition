import { render, screen, within } from '@testing-library/preact'
import { describe, expect, it } from 'vitest'
import { nutrition } from 'data-platform'
import { day } from '../day.ts'
import { fakeFoods } from '../foods/fake-foods.ts'
import type { FoodFields, Foods } from '../foods/foods.ts'
import { fakeLogStore } from '../log/fake-log-store.ts'
import type { LogStore } from '../log/log-store.ts'
import { quickToast, schnitzel } from '../log/log-store.contract.ts'
import { LogScreen } from './LogScreen.tsx'

const { grams, kcal } = nutrition

const schnitzelFields: FoodFields = {
  name: 'Schnitzel plate',
  place: 'Canteen',
  servingLabel: '1 plate',
  perServing: { kcal: kcal(500), proteinG: grams(30), carbsG: grams(50), fatG: grams(20) },
  estimated: false,
}

const TODAY = day('2026-03-10')
const NOW = new Date(2026, 2, 10, 13, 5)

/** Renders the screen over fakes; the Food is added first and the log holds an entry for it, so it is a Recent. */
async function setup({ withRecents = true }: { withRecents?: boolean } = {}) {
  const foods: Foods = fakeFoods()
  const log: LogStore = fakeLogStore()
  const foodId = await foods.add(schnitzelFields)
  if (withRecents) {
    await log.create({ ...schnitzel, source: { kind: 'food', foodId } })
    await log.create(quickToast)
  }
  const view = render(<LogScreen log={log} foods={foods} day={TODAY} now={NOW} onDone={() => {}} />)
  return { foods, log, foodId, ...view }
}

describe('LogScreen Recents', () => {
  it('lists Recents, Foods and Quick Entries alike', async () => {
    await setup()
    const recentsSection = await screen.findByRole('region', { name: 'Recents' })
    expect(await within(recentsSection).findByText('Schnitzel plate')).toBeInTheDocument()
    expect(within(recentsSection).getByText('Toast')).toBeInTheDocument()
  })
})
