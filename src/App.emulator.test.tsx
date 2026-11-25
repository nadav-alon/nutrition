import { fireEvent, render, screen, within } from '@testing-library/preact'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { core, nutrition } from 'data-platform'
import { App } from './App.tsx'
import { firestoreFoods } from './foods/firestore-foods.ts'
import { firestoreLogStore } from './log/firestore-log-store.ts'
import { firestoreTargetsPort } from './targets/firestore-targets-port.ts'
import { startEmulator, type Emulator } from './test/emulator.ts'

let emulator: Emulator

beforeAll(async () => {
  emulator = await startEmulator()
})

beforeEach(async () => {
  await emulator.reset(['member'])
  location.hash = ''
})

afterAll(async () => {
  await emulator?.close()
})

it('logs a Food, which then appears on today\'s Day against the Targets', async () => {
  const db = emulator.client('member')
  const uid = core.uid('member')
  const foods = firestoreFoods(db)
  const targets = firestoreTargetsPort(db, uid)
  await foods.add({
    name: 'Canteen schnitzel',
    perServing: { kcal: nutrition.kcal(620), proteinG: nutrition.grams(34), carbsG: nutrition.grams(41), fatG: nutrition.grams(33) },
    estimated: false,
  })
  await targets.write({ kcal: nutrition.kcal(2000) })

  render(<App log={firestoreLogStore(db, uid)} foods={foods} targets={targets} />)
  expect(await screen.findByText(/0 kcal eaten · 2000 kcal left/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Log' }))
  fireEvent.input(await screen.findByLabelText('Search foods'), { target: { value: 'schnitzel' } })
  fireEvent.click(await screen.findByRole('button', { name: /Canteen schnitzel/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }))

  expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
  expect(await screen.findByText('Canteen schnitzel')).toBeInTheDocument()
  expect(within(screen.getByRole('meter', { name: 'Calories' })).getByText(/620 kcal eaten · 1380 kcal left/)).toBeInTheDocument()
})
