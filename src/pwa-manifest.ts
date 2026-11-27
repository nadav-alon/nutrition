import type { ManifestOptions } from 'vite-plugin-pwa'
import { SEED } from './seed.ts'
import { themeRole } from './theme-role.ts'
import { APP_NAME } from './app-name.ts'
import { iconSrc } from './icon-src.ts'

const sizes = [192, 512]

const bareIcon = (size: number, purpose?: 'maskable') => ({
  file: `pwa-${purpose ? `${purpose}-` : ''}${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
  ...(purpose && { purpose }),
})

/** The icons by bare file name, unversioned: what the icon generator writes, so it needs no file to exist yet. */
export const iconFiles = [...sizes.map((size) => bareIcon(size)), ...sizes.map((size) => bareIcon(size, 'maskable'))]

const versioned = ({ file, ...rest }: (typeof iconFiles)[number]) => ({
  src: iconSrc(file),
  ...rest,
})

export const manifest: Partial<ManifestOptions> = {
  name: APP_NAME,
  short_name: APP_NAME,
  description: 'Log what you eat against your daily Targets',
  theme_color: SEED,
  background_color: themeRole('background'),
  display: 'standalone',
  start_url: '.',
  icons: iconFiles.map(versioned),
}
