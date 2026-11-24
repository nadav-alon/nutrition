/** The message of a caught value when it is an Error, otherwise `fallback`. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
