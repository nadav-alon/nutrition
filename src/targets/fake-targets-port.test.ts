import { fakeTargetsPort } from './fake-targets-port.ts'
import { targetsPortContract } from './targets-port.contract.ts'

targetsPortContract('fakeTargetsPort', async () => fakeTargetsPort())
