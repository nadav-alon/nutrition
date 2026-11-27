import { fakeSettingsPort } from './fake-settings-port.ts'
import { settingsPortContract } from './settings-port.contract.ts'

settingsPortContract('fakeSettingsPort', async () => fakeSettingsPort())
