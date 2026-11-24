const pad = (n: number) => String(n).padStart(2, '0')

/** `value` as a `datetime-local` input writes it, in the local time zone: `YYYY-MM-DDTHH:mm`. */
export function toLocalInput(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}

/** The instant a `datetime-local` value names in the local time zone, or undefined when it is empty or not a time. */
export function fromLocalInput(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}
