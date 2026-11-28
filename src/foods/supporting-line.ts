import type { nutrition } from 'data-platform'

/** Display rounding: one decimal, so summed or scaled floats never print as `30.000000000000004`. */
export function roundForDisplay(value: number): number {
  return Math.round(value * 10) / 10
}

/** The supporting line of a Food's row: its place, when it has one, then the kcal of one Serving. */
export function supportingLine({ place, perServing }: { place?: string; perServing: nutrition.Nutrition }): string {
  const kcal = `${roundForDisplay(perServing.kcal)} kcal`
  return place === undefined ? kcal : `${place} · ${kcal}`
}
