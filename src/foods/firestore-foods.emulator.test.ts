// @vitest-environment node
import { afterAll } from 'vitest'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreFoods } from './firestore-foods.ts'
import { foodsContract } from './foods.contract.ts'

let emulator: Emulator | undefined

afterAll(async () => {
  await emulator?.close()
})

foodsContract('firestoreFoods', async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreFoods(emulator.client('member'))
})
