// @vitest-environment node
import { afterAll, describe, expect, it, vi } from 'vitest'
import { core, nutrition } from 'data-platform'
import { startEmulator, type Emulator } from '../test/emulator.ts'
import { firestoreSettingsPort } from './firestore-settings-port.ts'
import { settingsPortContract, watchSwitch } from './settings-port.contract.ts'

let emulator: Emulator

afterAll(async () => {
  await emulator?.close()
})

const SETTINGS_PATH = `${nutrition.NUTRITION_SETTINGS_COLLECTION}/member`

async function freshPort() {
  emulator ??= await startEmulator()
  await emulator.reset(['member'])
  return firestoreSettingsPort(emulator.client('member'), core.uid('member'))
}

settingsPortContract('firestoreSettingsPort', freshPort)

describe('firestoreSettingsPort with a settings document lacking the field', () => {
  it('reads the switch as off', async () => {
    const port = await freshPort()
    await emulator.seed(SETTINGS_PATH, {})
    const watcher = watchSwitch(port)
    await watcher.until(1)
    watcher.stop()
    expect(watcher.seen).toEqual([false])
  })
})

describe('firestoreSettingsPort with a malformed settings document', () => {
  it('reports one error and delivers nothing', async () => {
    const port = await freshPort()
    await emulator.seed(SETTINGS_PATH, { googleHealthSync: false })
    const watcher = watchSwitch(port)
    await vi.waitFor(() => expect(watcher.errors).toHaveLength(1), { timeout: 2000 })
    watcher.stop()
    expect(watcher.seen).toEqual([])
  })
})
