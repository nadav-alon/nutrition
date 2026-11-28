import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** The directory the PWA icons live in, and the web root they are served from. */
export const PUBLIC_DIR = join(import.meta.dirname, '..', 'public')

declare const iconSrcBrand: unique symbol

/** An icon's versioned URL: `<file>?v=<8 hex>`, as `iconSrc` builds it. Not interchangeable with a bare icon file name. */
export type IconSrc = string & { readonly [iconSrcBrand]: true }

/** The guard: a `<file>?v=<8 hex>` string. */
export function isIconSrc(value: string): value is IconSrc {
  return /^[^?]+\?v=[0-9a-f]{8}$/.test(value)
}

/**
 * An icon's URL as the manifest and the favicon link carry it: the file name plus `?v=` and the
 * first 8 hex of the file's sha256 in `dir`. The URL changes exactly when the bytes do, which is
 * what tells an installed app to refetch the icon.
 */
export function iconSrc(file: string, dir: string = PUBLIC_DIR): IconSrc {
  const hash = createHash('sha256')
    .update(readFileSync(join(dir, file)))
    .digest('hex')
    .slice(0, 8)
  return `${file}?v=${hash}` as IconSrc
}

/** The file name inside an `iconSrc` URL. */
export function iconFile(src: IconSrc): string {
  return src.split('?')[0]!
}

/** Where the file behind an `iconSrc` URL lives. */
export function iconPath(src: IconSrc, dir: string = PUBLIC_DIR): string {
  return join(dir, iconFile(src))
}

/** The constructor for a URL that arrives as a plain string (a parsed manifest, say): narrows, or throws naming the value. */
export function parseIconSrc(value: string): IconSrc {
  if (!isIconSrc(value)) throw new Error(`Not an IconSrc: ${JSON.stringify(value)}`)
  return value
}
