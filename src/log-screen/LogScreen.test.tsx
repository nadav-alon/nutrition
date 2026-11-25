import { fireEvent, render, screen, waitFor, within } from '@testing-library/preact'
import { describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { day, dayEnd, dayStart, type Day } from '../day.ts'
import { fakeFoods } from '../foods/fake-foods.ts'
import type { FoodFields, Foods } from '../foods/foods.ts'
import { fakeLogStore } from '../log/fake-log-store.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
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
async function setup({ withRecents = true, viewed = TODAY }: { withRecents?: boolean; viewed?: Day } = {}) {
  const foods: Foods = fakeFoods()
  const log: LogStore = fakeLogStore()
  const foodId = await foods.add(schnitzelFields)
  if (withRecents) {
    await log.create({ ...schnitzel, source: { kind: 'food', foodId } })
    await log.create(quickToast)
  }
  const onDone = vi.fn()
  const view = render(<LogScreen log={log} foods={foods} day={viewed} now={NOW} onDone={onDone} />)
  return { foods, log, foodId, onDone, ...view }
}

describe('LogScreen Recents', () => {
  it('lists Recents, Foods and Quick Entries alike', async () => {
    await setup()
    const recentsSection = await screen.findByRole('region', { name: 'Recents' })
    expect(await within(recentsSection).findByText('Schnitzel plate')).toBeInTheDocument()
    expect(within(recentsSection).getByText('Toast')).toBeInTheDocument()
  })
})

describe('LogScreen search', () => {
  it('filters live Foods by name and by place as the Member types', async () => {
    const { foods } = await setup({ withRecents: false })
    await foods.add({ ...schnitzelFields, name: 'Lentil soup', place: 'Home' })
    const search = screen.getByLabelText('Search foods')

    fireEvent.input(search, { target: { value: 'SOUP' } })
    const found = await screen.findByRole('region', { name: 'Foods' })
    expect(within(found).getByText('Lentil soup')).toBeInTheDocument()
    expect(within(found).queryByText('Schnitzel plate')).toBeNull()

    fireEvent.input(search, { target: { value: 'canteen' } })
    expect(within(screen.getByRole('region', { name: 'Foods' })).getByText('Schnitzel plate')).toBeInTheDocument()
    expect(screen.queryByText('Lentil soup')).toBeNull()

    fireEvent.input(search, { target: { value: 'pizza' } })
    expect(screen.getByText('No Foods match.')).toBeInTheDocument()
  })

  it('follows Foods added while searching', async () => {
    const { foods } = await setup({ withRecents: false })
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'soup' } })
    await foods.add({ ...schnitzelFields, name: 'Lentil soup' })
    expect(await screen.findByText('Lentil soup')).toBeInTheDocument()
  })
})

/** The live entries on `viewed`, read once. */
function entriesOn(log: LogStore, viewed: Day) {
  let latest: readonly LogEntry[] = []
  log.watchDay(dayStart(viewed), dayEnd(viewed), (entries) => (latest = entries))()
  return latest
}

describe('LogScreen confirm step', () => {
  it('logs a Recent Food as per-Serving Nutrition × servings, with the guessed Meal Type, and returns to the Day', async () => {
    const { log, foodId, onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))

    expect(screen.getByLabelText('Servings')).toHaveValue(1)
    expect(screen.getByLabelText('Meal type')).toHaveValue('lunch')
    expect(screen.getByLabelText('Eaten at')).toHaveValue('2026-03-10T13:05')

    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '1.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())

    const logged = entriesOn(log, TODAY).find((entry) => entry.eatenAt.getTime() === NOW.getTime())
    expect(logged).toMatchObject({
      name: 'Schnitzel plate',
      source: { kind: 'food', foodId },
      servings: 1.5,
      mealType: 'lunch',
      nutrition: { kcal: 750, proteinG: 45, carbsG: 75, fatG: 30 },
    })
  })

  it('logs a Food found by search', async () => {
    const { log, onDone } = await setup({ withRecents: false })
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'canteen' } })
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, TODAY).map((entry) => entry.name)).toEqual(['Schnitzel plate'])
  })

  it('logging a Quick Entry Recent again makes a new Quick Entry with the same name and Nutrition', async () => {
    const { log, onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const logged = entriesOn(log, TODAY).find((entry) => entry.eatenAt.getTime() === NOW.getTime())
    expect(logged).toMatchObject({ name: 'Toast', source: { kind: 'quick' }, servings: 2, nutrition: { kcal: 360 } })
  })

  it('guesses the Meal Type from the eaten time until the Member picks one', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    fireEvent.input(screen.getByLabelText('Eaten at'), { target: { value: '2026-03-10T08:00' } })
    expect(screen.getByLabelText('Meal type')).toHaveValue('breakfast')
    fireEvent.change(screen.getByLabelText('Meal type'), { target: { value: 'snack' } })
    fireEvent.input(screen.getByLabelText('Eaten at'), { target: { value: '2026-03-10T18:00' } })
    expect(screen.getByLabelText('Meal type')).toHaveValue('snack')
  })

  it('defaults the eaten time on an earlier Day to that Day at the current clock time', async () => {
    const { log, onDone } = await setup({ viewed: day('2026-03-08') })
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    expect(screen.getByLabelText('Eaten at')).toHaveValue('2026-03-08T13:05')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, day('2026-03-08'))).toHaveLength(1)
  })

  it('goes back to choosing without logging', async () => {
    const { log, onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Recents' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect(entriesOn(log, TODAY).filter((entry) => entry.eatenAt.getTime() === NOW.getTime())).toEqual([])
  })

  it('blocks saving zero servings with a message', async () => {
    const { onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '0' } })
    expect(screen.getByText(/Servings must be a positive number/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows a failed save and stays on the confirm step', async () => {
    const { log, onDone } = await setup()
    vi.spyOn(log, 'create').mockRejectedValue(new Error('offline'))
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    expect(onDone).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})

/** Opens the Quick Entry form and fills its name and macros. */
function fillQuick(name: string, macros: { kcal: string; protein: string; carbs: string; fat: string }) {
  fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }))
  fireEvent.input(screen.getByLabelText('Name'), { target: { value: name } })
  fireEvent.input(screen.getByLabelText('Calories (kcal)'), { target: { value: macros.kcal } })
  fireEvent.input(screen.getByLabelText('Protein (g)'), { target: { value: macros.protein } })
  fireEvent.input(screen.getByLabelText('Carbs (g)'), { target: { value: macros.carbs } })
  fireEvent.input(screen.getByLabelText('Fat (g)'), { target: { value: macros.fat } })
}

const apple = { kcal: '95', protein: '0.5', carbs: '25', fat: '0.3' }

describe('LogScreen Quick Entry', () => {
  it('logs a Quick Entry with per-Serving Nutrition × servings and the confirm fields', async () => {
    const { log, onDone } = await setup({ withRecents: false })
    fillQuick('  Apple ', apple)
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    expect(screen.getByLabelText('Meal type')).toHaveValue('lunch')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, TODAY)).toEqual([
      expect.objectContaining({
        name: 'Apple',
        source: { kind: 'quick' },
        servings: 2,
        mealType: 'lunch',
        eatenAt: NOW,
        nutrition: { kcal: 190, proteinG: 1, carbsG: 50, fatG: 0.6 },
      }),
    ])
  })

  it('blocks saving an empty name with a message', async () => {
    const { log, onDone } = await setup({ withRecents: false })
    fillQuick('   ', apple)
    expect(screen.getByText('Enter a name.')).toBeInTheDocument()
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
    expect(entriesOn(log, TODAY)).toEqual([])
  })

  it('blocks saving a negative macro with a message', async () => {
    const { log, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', { ...apple, fat: '-1' })
    expect(screen.getByText('Must not be negative.')).toBeInTheDocument()
    fireEvent.submit(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
    expect(entriesOn(log, TODAY)).toEqual([])
  })

  it('blocks saving zero servings with a message', async () => {
    const { onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '0' } })
    expect(screen.getByText(/Servings must be a positive number/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('goes back to choosing without logging', async () => {
    const { onDone } = await setup({ withRecents: false })
    fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('region', { name: 'Recents' })).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
