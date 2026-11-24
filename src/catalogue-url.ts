import { url, isUrl, type Url } from './url.ts'

/** The Catalogue shares this origin; it is where a Household is claimed and joined. */
const DEFAULT_CATALOGUE_URL = url('/home-catalogue/')

/**
 * Where the Catalogue lives. It shares this origin when deployed; set `VITE_CATALOGUE_URL` where it
 * does not, as under `vite --mode emulator`. A set value that is not a URL throws, naming it.
 */
export function catalogueUrl(): Url {
  const configured: string | undefined = import.meta.env.VITE_CATALOGUE_URL
  if (!configured) return DEFAULT_CATALOGUE_URL
  if (!isUrl(configured)) throw new Error(`VITE_CATALOGUE_URL is not a Url: ${JSON.stringify(configured)}`)
  return configured
}
