// @vitest-environment node
import { afterAll, expect, it } from 'vitest'
import { getDoc, doc } from 'firebase/firestore'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreFoods } from './firestore-foods.ts'
import { foodsContract, schnitzel } from './foods.contract.ts'

let emulator: Emulator | undefined

afterAll(async () => {
  await emulator?.close()
})

foodsContract('firestoreFoods', async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreFoods(emulator.client('member'))
})

it('leaves the Log Entries that point at a soft-deleted Food untouched', async () => {
  const entry = {
    eatenAt: new Date('2026-11-24T12:00:00Z'),
    mealType: 'lunch',
    source: { kind: 'food', foodId: 'pending' },
    name: 'Canteen schnitzel',
    servings: 1,
    nutrition: { kcal: 620, proteinG: 34, carbsG: 41, fatG: 33 },
  }
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  const db = emulator.client('member')
  const foods = firestoreFoods(db)
  const id = await foods.add(schnitzel)
  entry.source.foodId = id
  await emulator.seed('nutritionLogs/member/entries/e1', entry)
  const before = (await getDoc(doc(db, 'nutritionLogs/member/entries/e1'))).data()
  await foods.softDelete(id)
  expect((await getDoc(doc(db, 'nutritionLogs/member/entries/e1'))).data()).toEqual(before)
  expect(before).toMatchObject({ source: { kind: 'food', foodId: id }, name: 'Canteen schnitzel' })
})
