import { fireEvent, screen, waitFor, within } from '@testing-library/preact'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nutrition } from 'data-platform'
import { day, dayEnd, dayStart, type Day } from '../day.ts'
import { fakeFoods } from '../foods/fake-foods.ts'
import type { FoodFields, Foods, SavedFood } from '../foods/foods.ts'
import { fakeLogStore } from '../log/fake-log-store.ts'
import type { LogEntry, LogStore } from '../log/log-store.ts'
import { quickToast, schnitzel } from '../log/log-store.contract.ts'
import type { EstimateLink } from '../estimate-link.ts'
import { expectOneBackInAppBar, renderInAppBar } from '../test/render-in-app-bar.tsx'
import { LogScreen } from './LogScreen.tsx'

const { grams, kcal } = nutrition

const schnitzelFields: FoodFields = {
  name: 'Schnitzel plate',
  place: 'Canteen',
  servingLabel: '1 plate',
  perServing: { kcal: kcal(500), proteinG: grams(30), carbsG: grams(50), fatG: grams(20) },
  estimated: false,
}

beforeEach(() => {
  // A step entry left by an earlier test would count as the current test's own.
  history.replaceState(null, '', location.href)
})

const TODAY = day('2026-03-10')
const NOW = new Date(2026, 2, 10, 13, 5)

/** Renders the screen over fakes; the Food is added first and the log holds an entry for it, so it is a Recent. */
async function setup({
  withRecents = true,
  viewed = TODAY,
  extraEntries = [],
}: { withRecents?: boolean; viewed?: Day; extraEntries?: readonly Parameters<LogStore['create']>[0][] } = {}) {
  const foods: Foods = fakeFoods()
  const log: LogStore = fakeLogStore()
  const foodId = await foods.add(schnitzelFields)
  if (withRecents) {
    await log.create({ ...schnitzel, source: { kind: 'food', foodId } })
    await log.create(quickToast)
    for (const extra of extraEntries) await log.create(extra)
  }
  const onDone = vi.fn()
  const view = renderInAppBar(<LogScreen log={log} foods={foods} day={viewed} now={NOW} onDone={onDone} />)
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

describe('LogScreen Recents, beyond the list', () => {
  it('puts the search field above Recents, and Food results replace Recents while a query is typed', async () => {
    await setup()
    const search = screen.getByLabelText('Search foods')
    const recentsSection = await screen.findByRole('region', { name: 'Recents' })
    expect(search.compareDocumentPosition(recentsSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.input(search, { target: { value: 'schnitzel' } })
    expect(await screen.findByRole('region', { name: 'Foods' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Recents' })).toBeNull()
  })

  it('shows no Recents heading when there are none', async () => {
    await setup({ withRecents: false })
    expect(screen.queryByText('Recents')).toBeNull()
  })

  it('offers a Quick Entry with the typed name prefilled when no Food matches', async () => {
    await setup({ withRecents: false })
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'Pizza slice' } })
    fireEvent.click(await screen.findByRole('button', { name: /Quick entry for/ }))
    expect(screen.getByLabelText('Name')).toHaveValue('Pizza slice')
  })

  it('leaves a soft-deleted Food out of Recents and of search', async () => {
    const { foods, foodId } = await setup()
    await foods.softDelete(foodId)
    expect(within(await screen.findByRole('region', { name: 'Recents' })).queryByText('Schnitzel plate')).toBeNull()
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'schnitzel' } })
    expect(await screen.findByText('No Foods match.')).toBeInTheDocument()
  })

  it('shows a failure to watch the Foods', async () => {
    const foods = fakeFoods()
    vi.spyOn(foods, 'watch').mockImplementation((_listener, onError) => {
      onError?.(new Error('foods offline'))
      return () => {}
    })
    renderInAppBar(<LogScreen log={fakeLogStore()} foods={foods} day={TODAY} now={NOW} onDone={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('foods offline')
  })

  it('shows a failure to load Recents', async () => {
    const log = fakeLogStore()
    vi.spyOn(log, 'recent').mockRejectedValue(new Error('recents offline'))
    renderInAppBar(<LogScreen log={log} foods={fakeFoods()} day={TODAY} now={NOW} onDone={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('recents offline')
  })
})

describe('LogScreen rows', () => {
  it('shows place · kcal and the Estimated mark on Recents and on results, telling same-named Foods apart', async () => {
    const { foods } = await setup()
    await foods.add({ ...schnitzelFields, place: 'Home', perServing: { ...schnitzelFields.perServing, kcal: kcal(420) }, estimated: true })
    const recentsSection = await screen.findByRole('region', { name: 'Recents' })
    expect(within(recentsSection).getByText('Canteen · 500 kcal')).toBeInTheDocument()
    expect(within(recentsSection).getByText('180 kcal')).toBeInTheDocument()

    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'schnitzel' } })
    const found = await screen.findByRole('region', { name: 'Foods' })
    expect(within(found).getByText('Canteen · 500 kcal')).toBeInTheDocument()
    expect(within(found).getByText('Home · 420 kcal')).toBeInTheDocument()
    expect(within(found).getAllByText('Estimated')).toHaveLength(1)
  })

  it('marks an Estimated Quick Entry Recent', async () => {
    await setup({ extraEntries: [{ ...quickToast, name: 'Guess', estimated: true }] })
    const recentsSection = await screen.findByRole('region', { name: 'Recents' })
    expect(within(recentsSection).getAllByText('Estimated')).toHaveLength(1)
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

  it('shows kcal and macros for the chosen Servings, following the Servings field', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    const summary = screen.getByLabelText('Nutrition for these Servings')
    expect(summary).toHaveTextContent('500 kcal · 30 g protein · 50 g carbs · 20 g fat')
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '1.5' } })
    expect(summary).toHaveTextContent('750 kcal · 45 g protein · 75 g carbs · 30 g fat')
  })

  it('keeps showing kcal and macros for the Servings while the eaten time is cleared', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    fireEvent.input(screen.getByLabelText('Eaten at'), { target: { value: '' } })
    expect(screen.getByLabelText('Nutrition for these Servings')).toHaveTextContent('500 kcal')
  })

  it('logging an Estimated Food stores estimated on the entry', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    await foods.add({ ...schnitzelFields, name: 'Guessed stew', estimated: true })
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'stew' } })
    fireEvent.click(await screen.findByRole('button', { name: /Guessed stew/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(entriesOn(log, TODAY)[0]).toMatchObject({ name: 'Guessed stew', source: { kind: 'food' }, estimated: true })
  })

  it('logging a Food that is not Estimated stores no estimated flag', async () => {
    const { log, onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const logged = entriesOn(log, TODAY).find((entry) => entry.eatenAt.getTime() === NOW.getTime())
    expect(logged).not.toHaveProperty('estimated')
  })

  it('keeps the flag on an existing entry when the Food is corrected afterwards', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    const id = await foods.add({ ...schnitzelFields, name: 'Guessed stew', estimated: true })
    fireEvent.input(screen.getByLabelText('Search foods'), { target: { value: 'stew' } })
    fireEvent.click(await screen.findByRole('button', { name: /Guessed stew/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    await foods.edit(id, { estimated: false })
    expect(entriesOn(log, TODAY)[0]).toMatchObject({ estimated: true })
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

  it('logging an Estimated Quick Entry Recent again keeps it Estimated', async () => {
    const { log, onDone } = await setup({ extraEntries: [{ ...quickToast, name: 'Guess', estimated: true }] })
    fireEvent.click(await screen.findByRole('button', { name: /Guess/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const logged = entriesOn(log, TODAY).find((entry) => entry.name === 'Guess' && entry.eatenAt.getTime() === NOW.getTime())
    expect(logged).toMatchObject({ estimated: true })
  })

  it('logging a non-Estimated Quick Entry Recent again stores no Estimated flag', async () => {
    const { log, onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const logged = entriesOn(log, TODAY).find((entry) => entry.name === 'Toast' && entry.eatenAt.getTime() === NOW.getTime())
    expect(logged).toMatchObject({ name: 'Toast' })
    expect(logged).not.toHaveProperty('estimated')
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
    expect(await screen.findByRole('region', { name: 'Recents' })).toBeInTheDocument()
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
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})

/** The live Foods, read once. */
function foodsIn(foods: Foods) {
  let latest: readonly SavedFood[] = []
  foods.watch((list) => (latest = list))()
  return latest
}

describe('LogScreen Quick Entry saved as a Food', () => {
  it('creates the Food first and logs a Food entry instead of a Quick Entry', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.input(screen.getByLabelText('Place (optional)'), { target: { value: ' Home ' } })
    fireEvent.input(screen.getByLabelText('Serving label (optional)'), { target: { value: '1 apple' } })
    fireEvent.click(screen.getByLabelText('Estimated'))
    fireEvent.input(screen.getByLabelText('Servings'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())

    const saved = foodsIn(foods).find((food) => food.name === 'Apple')
    expect(saved).toMatchObject({
      place: 'Home',
      servingLabel: '1 apple',
      estimated: true,
      perServing: { kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3 },
    })
    expect(entriesOn(log, TODAY)).toEqual([
      expect.objectContaining({ name: 'Apple', source: { kind: 'food', foodId: saved?.id }, servings: 2 }),
    ])
  })

  it('leaves out an empty place and serving label, and is not Estimated by default', async () => {
    const { foods, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const saved = foodsIn(foods).find((food) => food.name === 'Apple')
    expect(saved?.estimated).toBe(false)
    expect(saved?.place).toBeUndefined()
    expect(saved?.servingLabel).toBeUndefined()
  })

  it('does not save a Food when the box is unticked', async () => {
    const { foods, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    expect(screen.queryByLabelText('Place (optional)')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods).map((food) => food.name)).toEqual(['Schnitzel plate'])
  })

  it('on a failed log, keeps the form and a retry reuses the Food it already saved', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    const create = vi.spyOn(log, 'create').mockRejectedValueOnce(new Error('offline'))
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(create).toHaveBeenCalledTimes(2)
    expect(foodsIn(foods).filter((food) => food.name === 'Apple')).toHaveLength(1)
  })

  it('on a retry after editing the fields, brings the Food it saved up to date and logs against it', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    vi.spyOn(log, 'create').mockRejectedValueOnce(new Error('offline'))
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Green apple' } })
    fireEvent.input(screen.getByLabelText('Calories (kcal)'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    const apples = foodsIn(foods).filter((food) => food.name.includes('apple') || food.name.includes('Apple'))
    expect(apples).toHaveLength(1)
    expect(apples[0]).toMatchObject({ name: 'Green apple', perServing: { kcal: 80 } })
    expect(entriesOn(log, TODAY)).toEqual([
      expect.objectContaining({ name: 'Green apple', source: { kind: 'food', foodId: apples[0]?.id } }),
    ])
  })

  it('on a retry with Save as Food unticked, removes the Food the first attempt saved and logs a Quick Entry', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    vi.spyOn(log, 'create').mockRejectedValueOnce(new Error('offline'))
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods).map((food) => food.name)).toEqual(['Schnitzel plate'])
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ name: 'Apple', source: { kind: 'quick' } })])
  })

  it('logs once when Save is submitted twice at once', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Save as Food'))
    const form = screen.getByRole('button', { name: 'Save' }).closest('form') as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, TODAY)).toHaveLength(1)
    expect(foodsIn(foods).filter((food) => food.name === 'Apple')).toHaveLength(1)
  })

  it('shows no validation message until a field has been typed in', async () => {
    await setup({ withRecents: false })
    fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }))
    expect(screen.queryByText('Enter a name.')).toBeNull()
    expect(screen.queryByText('Enter a number.')).toBeNull()
    fireEvent.input(screen.getByLabelText('Name'), { target: { value: ' ' } })
    expect(screen.getByText('Enter a name.')).toBeInTheDocument()
    expect(screen.queryByText('Enter a number.')).toBeNull()
  })
})

describe('LogScreen Quick Entry that is Estimated but not saved as a Food', () => {
  it('stores the Log Entry as estimated, with no Food created', async () => {
    const { foods, log, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByLabelText('Estimated'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, TODAY)).toEqual([
      expect.objectContaining({ name: 'Apple', source: { kind: 'quick' }, estimated: true }),
    ])
    expect(foodsIn(foods).map((food) => food.name)).toEqual(['Schnitzel plate'])
  })

  it('leaves the entry unflagged when not Estimated', async () => {
    const { log, onDone } = await setup({ withRecents: false })
    fillQuick('Apple', apple)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(entriesOn(log, TODAY)[0]?.estimated).toBeUndefined()
  })
})

describe('LogScreen opened from an estimate link', () => {
  const full: EstimateLink = {
    name: 'Shawarma plate',
    place: 'Hummus Bar',
    kcal: '820',
    proteinG: '41',
    carbsG: '70',
    fatG: '38',
    servings: '1.5',
    estimated: true,
  }

  async function setupLink(estimate: EstimateLink) {
    const foods: Foods = fakeFoods()
    const log: LogStore = fakeLogStore()
    const onDone = vi.fn()
    renderInAppBar(<LogScreen log={log} foods={foods} day={TODAY} now={NOW} onDone={onDone} estimate={estimate} />)
    return { foods, log, onDone }
  }

  it('opens a Quick Entry filled from a full link, with Save as Food ticked and Estimated set', async () => {
    await setupLink(full)
    expect(screen.getByLabelText('Name')).toHaveValue('Shawarma plate')
    expect(screen.getByLabelText('Place (optional)')).toHaveValue('Hummus Bar')
    expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(820)
    expect(screen.getByLabelText('Protein (g)')).toHaveValue(41)
    expect(screen.getByLabelText('Carbs (g)')).toHaveValue(70)
    expect(screen.getByLabelText('Fat (g)')).toHaveValue(38)
    expect(screen.getByLabelText('Servings')).toHaveValue(1.5)
    expect(screen.getByLabelText('Save as Food')).toBeChecked()
    expect(screen.getByLabelText('Estimated')).toBeChecked()
    expect(screen.getByLabelText('Meal type')).toHaveValue('lunch')
    expect(screen.getByLabelText('Eaten at')).toHaveValue('2026-03-10T13:05')
  })

  it('saves nothing until Save, then saves the Food and logs it with the servings', async () => {
    const { foods, log, onDone } = await setupLink(full)
    expect(foodsIn(foods)).toEqual([])
    expect(entriesOn(log, TODAY)).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods)).toEqual([
      expect.objectContaining({ name: 'Shawarma plate', place: 'Hummus Bar', estimated: true }),
    ])
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ name: 'Shawarma plate', servings: 1.5 })])
  })

  it('logs against an existing Food with the same name and place, with that Food\'s own values', async () => {
    const { foods, log, onDone } = await setupLink(full)
    const existingId = await foods.add({ ...schnitzelFields, name: 'Shawarma plate', place: 'Hummus Bar' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods)).toEqual([expect.objectContaining({ id: existingId, perServing: schnitzelFields.perServing, estimated: false })])
    const [entry] = entriesOn(log, TODAY)
    expect(entry).toEqual(expect.objectContaining({ name: 'Shawarma plate', source: { kind: 'food', foodId: existingId }, servings: 1.5 }))
    expect(entry?.nutrition.kcal).toBe(750)
    expect(entry?.estimated).toBeUndefined()
  })

  it('matches the existing Food ignoring case and surrounding space', async () => {
    const { foods, log, onDone } = await setupLink(full)
    const existingId = await foods.add({ ...schnitzelFields, name: ' shawarma PLATE ', place: 'hummus bar' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods)).toHaveLength(1)
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ source: { kind: 'food', foodId: existingId } })])
  })

  it('still creates a Food when only the name matches an existing Food', async () => {
    const { foods, log, onDone } = await setupLink(full)
    const otherId = await foods.add({ ...schnitzelFields, name: 'Shawarma plate', place: 'Other Place' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods)).toHaveLength(2)
    const created = foodsIn(foods).find((food) => food.id !== otherId)
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ source: { kind: 'food', foodId: created?.id } })])
  })

  it('with Save as Food unticked, logs a Quick Entry and leaves the Foods alone even when a Food matches', async () => {
    const { foods, log, onDone } = await setupLink(full)
    await foods.add({ ...schnitzelFields, name: 'Shawarma plate', place: 'Hummus Bar' })
    fireEvent.click(screen.getByLabelText('Save as Food'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(foodsIn(foods)).toHaveLength(1)
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ name: 'Shawarma plate', source: { kind: 'quick' }, estimated: true })])
  })

  it('drops the Food a failed first save created when a retry edits the form into a match for another Food', async () => {
    const { foods, log, onDone } = await setupLink(full)
    const existingId = await foods.add({ ...schnitzelFields, name: 'Shawarma plate', place: 'Other Place' })
    const create = vi.spyOn(log, 'create').mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    expect(foodsIn(foods)).toHaveLength(2)
    fireEvent.input(screen.getByLabelText('Place (optional)'), { target: { value: 'Other Place' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(create).toHaveBeenCalledTimes(2)
    expect(foodsIn(foods)).toEqual([expect.objectContaining({ id: existingId })])
    expect(entriesOn(log, TODAY)).toEqual([expect.objectContaining({ source: { kind: 'food', foodId: existingId } })])
  })

  it('leaves what a partial link omits empty, blocks Save, and stays editable', async () => {
    await setupLink({ ...full, place: '', kcal: '', proteinG: '', carbsG: '', fatG: '', servings: '1', estimated: false })
    expect(screen.getByLabelText('Name')).toHaveValue('Shawarma plate')
    expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(null)
    expect(screen.getByLabelText('Servings')).toHaveValue(1)
    expect(screen.getByLabelText('Estimated')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.input(screen.getByLabelText('Calories (kcal)'), { target: { value: '500' } })
    fireEvent.input(screen.getByLabelText('Protein (g)'), { target: { value: '20' } })
    fireEvent.input(screen.getByLabelText('Carbs (g)'), { target: { value: '50' } })
    fireEvent.input(screen.getByLabelText('Fat (g)'), { target: { value: '10' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('blocks Save for an invalid link, with no name and no Nutrition', async () => {
    await setupLink({ ...full, name: '', place: '', kcal: '', proteinG: '', carbsG: '', fatG: '', servings: '1', estimated: false })
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
})

describe('LogScreen back arrow', () => {
  it('has one Back on each step', async () => {
    renderInAppBar(<LogScreen log={fakeLogStore()} foods={fakeFoods()} day={TODAY} now={NOW} onDone={vi.fn()} />)
    expectOneBackInAppBar()
    fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }))
    expectOneBackInAppBar()
  })

  it('has one Back on the Confirm step', async () => {
    await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Schnitzel plate/ }))
    await screen.findByLabelText('Servings')
    expectOneBackInAppBar()
  })
})

describe('LogScreen system back', () => {
  it('returns from the confirm step to the Log list', async () => {
    const { onDone } = await setup()
    const depth = history.length
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    expect(history.length).toBe(depth + 1)
    history.back()
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('returns from the Quick Entry step to the Log list', async () => {
    const { onDone } = await setup({ withRecents: false })
    fireEvent.click(screen.getByRole('button', { name: 'Quick entry' }))
    history.back()
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('leaves the history where it started once a step is saved', async () => {
    const { onDone } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    const depth = history.length
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(history.length).toBe(depth)
    expect(location.hash).toBe('')
  })
})

describe('LogScreen system back, beyond one visit', () => {
  it('drops a step entry it remounts onto, so the list needs one Back, not two', async () => {
    const { onDone, unmount } = await setup()
    fireEvent.click(await screen.findByRole('button', { name: /Toast/ }))
    expect(history.state).toMatchObject({ logStep: true })
    unmount()
    const remounted = renderInAppBar(<LogScreen log={fakeLogStore()} foods={fakeFoods()} day={TODAY} now={NOW} onDone={onDone} />)
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    await waitFor(() => expect(history.state).not.toMatchObject({ logStep: true }))
    remounted.unmount()
  })

  it('gives an estimate link’s Quick Entry its own entry, so system back and Back both return to the list', async () => {
    const onDone = vi.fn()
    renderInAppBar(
      <LogScreen log={fakeLogStore()} foods={fakeFoods()} day={TODAY} now={NOW} onDone={onDone} estimate={{ name: 'Shawarma plate', place: '', kcal: '', proteinG: '', carbsG: '', fatG: '', servings: '1', estimated: false }} />,
    )
    await waitFor(() => expect(history.state).toMatchObject({ logStep: true }))
    history.back()
    expect(await screen.findByLabelText('Search foods')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})
