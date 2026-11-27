import { doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import { nutrition, type core } from 'data-platform'
import type { SettingsPort } from './settings-port.ts'

/**
 * A `SettingsPort` over `nutritionSettings/{uid}`. The switch is stored as `googleHealthSync: true`
 * and off as the field's absence, which is also how a Member with no document reads.
 */
export function firestoreSettingsPort(db: Firestore, uid: core.Uid): SettingsPort {
  const ref = doc(db, nutrition.NUTRITION_SETTINGS_COLLECTION, uid)
  return {
    watchGoogleHealthSync(onChange, onError) {
      return onSnapshot(
        ref,
        (snapshot) => {
          if (!snapshot.exists()) return onChange(false)
          const parsed = nutrition.nutritionSettingsSchema.safeParse(snapshot.data())
          if (parsed.success) onChange(parsed.data.googleHealthSync === true)
          else onError(new Error(`Malformed Nutrition Settings document: ${parsed.error.message}`))
        },
        onError,
      )
    },
    async setGoogleHealthSync(on) {
      // The rules refuse `false` and a hard delete, so off is a document without the field.
      await setDoc(ref, on ? { googleHealthSync: true } : {})
    },
  }
}
