import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { SEED } from '../src/seed.ts'
import { themeRole } from '../src/theme-role.ts'

/** The seed's on-primary colour, from src/theme.css (generated from the seed, and pinned to it by theme.test.ts): what the glyph is drawn in. */
export const ON_SEED = themeRole('on-primary')

/** The glyph's scale: the maskable one is smaller, to stay inside the 80% safe zone. */
const SCALE = { any: 1.1, maskable: 0.85 }

/** The PNG for a manifest icon entry, drawn from the apple SVG at its `sizes`, in the seed's colours. */
export function renderIcon(icon: { sizes?: string | undefined; purpose?: unknown }): Buffer {
  const size = Number.parseInt(icon.sizes ?? '', 10)
  const scale = icon.purpose === 'maskable' ? SCALE.maskable : SCALE.any
  const svg = readFileSync(join(import.meta.dirname, 'icons', 'apple.svg'), 'utf8')
    .replaceAll('{{SEED}}', SEED)
    .replaceAll('{{ON_SEED}}', ON_SEED)
    .replaceAll('{{SCALE}}', String(scale))
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}
