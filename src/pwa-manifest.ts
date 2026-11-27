import { join } from 'node:path'
import type { ManifestOptions } from 'vite-plugin-pwa'
import { SEED } from './seed.ts'
import { themeRole } from './theme-role.ts'
import { APP_NAME } from './app-name.ts'
import { iconSrc } from './icon-src.ts'

const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')

const sizes = [192, 512]

const icon = (size: number, purpose?: 'maskable') => ({
  src: iconSrc(`pwa-${purpose ? `${purpose}-` : ''}${size}x${size}.png`, PUBLIC_DIR),
  sizes: `${size}x${size}`,
  type: 'image/png',
  ...(purpose && { purpose }),
})

export const manifest: Partial<ManifestOptions> = {
  name: APP_NAME,
  short_name: APP_NAME,
  description: 'Log what you eat against your daily Targets',
  theme_color: SEED,
  background_color: themeRole('background'),
  display: 'standalone',
  start_url: '.',
  icons: [...sizes.map((size) => icon(size)), ...sizes.map((size) => icon(size, 'maskable'))],
}
