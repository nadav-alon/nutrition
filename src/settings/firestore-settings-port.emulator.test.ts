// @vitest-environment node
import { afterAll, describe, expect, it } from 'vitest'
import { core } from 'data-platform'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreSettingsPort } from './firestore-settings-port.ts'
import { settingsPortContract, watchSwitch } from './settings-port.contract.ts'

let emulator: Emulator

afterAll(async () => {
  await emulator?.close()
})

settingsPortContract('firestoreSettingsPort', async () => {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreSettingsPort(emulator.client('member'), core.uid('member'))
})

describe('firestoreSettingsPort with a settings document lacking the field', () => {
  it('reads the switch as off', async () => {
    emulator ??= await startEmulator()
    await emulator.reset(['member'])
    await emulator.seed('nutritionSettings/member', {})
    const watcher = watchSwitch(firestoreSettingsPort(emulator.client('member'), core.uid('member')))
    await watcher.until(1)
    watcher.stop()
    expect(watcher.seen).toEqual([false])
  })
})

describe('firestoreSettingsPort with a malformed settings document', () => {
  it('reports one error and delivers nothing', async () => {
    emulator ??= await startEmulator()
    await emulator.reset(['member'])
    await emulator.seed('nutritionSettings/member', { googleHealthSync: false })
    const watcher = watchSwitch(firestoreSettingsPort(emulator.client('member'), core.uid('member')))
    await new Promise((r) => setTimeout(r, 500))
    watcher.stop()
    expect(watcher.errors).toHaveLength(1)
    expect(watcher.seen).toEqual([])
  })
})
