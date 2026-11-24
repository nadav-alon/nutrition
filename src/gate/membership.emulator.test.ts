// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { householdExists, isHouseholdMember } from 'data-platform/client'
import { startEmulator, type Emulator } from '../test/emulator.ts'

let emulator: Emulator

beforeEach(async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
})

afterAll(async () => {
  await emulator?.close()
})

/** The AuthGate's lookups, run against the platform's own Firestore rules. */
describe('membership under the platform rules', () => {
  it('tells a Member from a signed-in non-Member', async () => {
    const asMember = emulator.client('member')
    const asStranger = emulator.client('stranger')
    expect(await householdExists(asStranger)).toBe(true)
    expect(await isHouseholdMember(asMember, core.uid('member'))).toBe(true)
    expect(await isHouseholdMember(asStranger, core.uid('stranger'))).toBe(false)
  })
})
