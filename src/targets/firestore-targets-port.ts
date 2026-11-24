import { doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import { nutrition, type core } from 'data-platform'
import type { TargetsPort } from './targets-port.ts'

/** A `TargetsPort` over `nutritionTargets/{uid}`; a Member with no document has no Targets set. */
export function firestoreTargetsPort(db: Firestore, uid: core.Uid): TargetsPort {
  const ref = doc(db, nutrition.NUTRITION_TARGETS_COLLECTION, uid)
  return {
    subscribe(onChange, onError) {
      return onSnapshot(
        ref,
        (snapshot) => {
          if (!snapshot.exists()) return onChange(null)
          const parsed = nutrition.targetsSchema.safeParse(snapshot.data())
          if (parsed.success) onChange(parsed.data)
          else onError(new Error(`Malformed Targets document: ${parsed.error.message}`))
        },
        onError,
      )
    },
    async write(targets) {
      // A set, not a merge, so a Target left out is removed from the document. Firestore rejects undefined.
      const fields = Object.fromEntries(Object.entries(targets).filter(([, value]) => value !== undefined))
      await setDoc(ref, fields)
    },
  }
}
