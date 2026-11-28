/** The mark on a row whose Nutrition is an estimate, or nothing when it is not; for a row's `trailing`. */
export function estimatedMark(estimated: boolean | undefined) {
  return estimated ? <span>Estimated</span> : undefined
}
