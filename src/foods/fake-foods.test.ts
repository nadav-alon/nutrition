import { fakeFoods } from './fake-foods.ts'
import { foodsContract } from './foods.contract.ts'

foodsContract('fakeFoods', async () => fakeFoods())
