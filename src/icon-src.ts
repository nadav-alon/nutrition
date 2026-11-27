import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * An icon's URL as the manifest and the favicon link carry it: the file name plus `?v=` and the
 * first 8 hex of the file's sha256 in `dir`. The URL changes exactly when the bytes do, which is
 * what tells an installed app to refetch the icon.
 */
export function iconSrc(file: string, dir: string): string {
  const hash = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex').slice(0, 8)
  return `${file}?v=${hash}`
}

/** The file name inside an `iconSrc` URL. */
export function iconFile(src: string): string {
  return src.split('?')[0]!
}
