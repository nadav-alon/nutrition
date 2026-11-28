import type { nutrition } from 'data-platform'

/** The supporting line of a Food's row: its place, when it has one, then the kcal of one Serving. */
export function supportingLine({ place, perServing }: { place?: string; perServing: nutrition.Nutrition }): string {
  const kcal = `${Math.round(perServing.kcal * 10) / 10} kcal`
  return place === undefined ? kcal : `${place} · ${kcal}`
}
