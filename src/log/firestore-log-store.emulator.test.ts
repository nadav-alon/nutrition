// @vitest-environment node
import { afterAll } from 'vitest'
import { core } from 'data-platform'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreLogStore } from './firestore-log-store.ts'
import { logStoreContract } from './log-store.contract.ts'

let emulator: Emulator

afterAll(async () => {
  await emulator?.close()
})

logStoreContract('firestoreLogStore', async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreLogStore(emulator.client('member'), core.uid('member'))
})
