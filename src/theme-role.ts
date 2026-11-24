import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hexColour, type HexColour } from './hex-colour.ts'

/**
 * The light scheme's hex for a `--md-sys-color-<name>` role, read from the generated `theme.css`
 * (build-time code is loaded by plain Node, which cannot load household-ui's TypeScript);
 * `theme.test.ts` pins that file to the seed. Throws when the role is missing.
 */
export function themeRole(name: string): HexColour {
  const css = readFileSync(join(import.meta.dirname, 'theme.css'), 'utf8')
  const found = css.match(new RegExp(`--md-sys-color-${name}: (#[0-9a-f]{6});`))?.[1]
  if (found === undefined) throw new Error(`theme.css has no --md-sys-color-${name}`)
  return hexColour(found)
}
