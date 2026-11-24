import type { ManifestOptions } from 'vite-plugin-pwa'
import { SEED } from './seed.ts'
import { themeRole } from './theme-role.ts'

const sizes = [192, 512]

const icon = (size: number, purpose?: 'maskable') => ({
  src: `pwa-${purpose ? `${purpose}-` : ''}${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
  ...(purpose && { purpose }),
})

export const manifest: Partial<ManifestOptions> = {
  name: 'Nutrition',
  short_name: 'Nutrition',
  description: 'Log what you eat against your daily Targets',
  theme_color: SEED,
  background_color: themeRole('background'),
  display: 'standalone',
  start_url: '.',
  icons: [...sizes.map((size) => icon(size)), ...sizes.map((size) => icon(size, 'maskable'))],
}
