// @vitest-environment node
import { afterAll } from 'vitest'
import { core } from 'data-platform'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreTargetsPort } from './firestore-targets-port.ts'
import { targetsPortContract } from './targets-port.contract.ts'

let emulator: Emulator

afterAll(async () => {
  await emulator?.close()
})

targetsPortContract('firestoreTargetsPort', async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreTargetsPort(emulator.client('member'), core.uid('member'))
})
