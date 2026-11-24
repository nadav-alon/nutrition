import { fakeLogStore } from './fake-log-store.ts'
import { logStoreContract } from './log-store.contract.ts'

logStoreContract('fakeLogStore', async () => fakeLogStore())
