import { DEFAULT_SCENARIO, scenarioName, type ScenarioName } from './ux-scenarios.ts'

const USAGE = 'Usage: npm run ux -- [--scenario <name>]'

/** The scenario named by `--scenario <name>` or `--scenario=<name>`, or the default when there is none. Throws on anything else. */
export function parseUxArgs(args: readonly string[]): ScenarioName {
  if (args.length === 0) return DEFAULT_SCENARIO
  const [flag, ...rest] = args
  if (flag === '--scenario' && rest.length === 1) return scenarioName(rest[0]!)
  if (flag!.startsWith('--scenario=') && rest.length === 0) return scenarioName(flag!.slice('--scenario='.length))
  throw new Error(USAGE)
}
