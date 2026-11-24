// @vitest-environment node
import { afterAll, describe, expect, it, vi } from 'vitest'
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

describe('firestoreTargetsPort with a malformed Targets document', () => {
  it('reports one error and delivers no Targets', async () => {
    emulator ??= await startEmulator()
    await emulator.reset(['member'])
    await emulator.seed('nutritionTargets/member', { kcal: 'plenty' })
    const port = firestoreTargetsPort(emulator.client('member'), core.uid('member'))
    const delivered: unknown[] = []
    const errors: Error[] = []
    const stop = port.subscribe((targets) => delivered.push(targets), (error) => errors.push(error))
    await vi.waitFor(() => expect(errors).toHaveLength(1), { timeout: 2000 })
    stop()
    expect(delivered).toEqual([])
  })
})
