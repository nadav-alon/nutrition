// Regenerates the PWA icons in public/ from the apple SVG in scripts/icons/, which renderIcon fills with the seed in src/seed.ts and its on-primary colour.
// The icon list is the manifest's: one file per entry, by bare file name, drawn by renderIcon.
import { writeFileSync } from 'node:fs'
import { iconFiles } from '../src/pwa-manifest.ts'
import { renderIcon } from './app-icons.ts'

for (const icon of iconFiles) writeFileSync(`public/${icon.file}`, renderIcon(icon))
