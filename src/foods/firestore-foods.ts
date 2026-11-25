import { addDoc, collection, deleteField, doc, onSnapshot, runTransaction, serverTimestamp, type DocumentSnapshot, type Firestore } from 'firebase/firestore'
import { nutrition } from 'data-platform'
import { byName, type Foods, type SavedFood } from './foods.ts'

/**
 * `Foods` over the platform's `foods` collection, as the signed-in Member that `db` belongs to.
 * A stored document that does not parse as a Food is left out of the list rather than failing it.
 */
export function firestoreFoods(db: Firestore): Foods {
  const foods = collection(db, nutrition.FOODS_COLLECTION)
  return {
    watch(listener, onError) {
      return onSnapshot(foods, (snapshot) => {
        const live: SavedFood[] = []
        for (const snap of snapshot.docs) {
          const data = snap.data()
          if (data.deletedAt !== undefined) continue
          const parsed = nutrition.foodSchema.safeParse(data)
          if (!parsed.success) continue
          const { name, place, servingLabel, perServing, estimated } = parsed.data
          live.push({ id: nutrition.foodId(snap.id), name, place, servingLabel, perServing, estimated: estimated === true })
        }
        listener(live.sort(byName))
      }, (error) => onError?.(error))
    },
    async add({ name, place, servingLabel, perServing, estimated }) {
      const created = await addDoc(foods, {
        name,
        ...(place === undefined ? {} : { place }),
        ...(servingLabel === undefined ? {} : { servingLabel }),
        perServing,
        ...(estimated ? { estimated: true } : {}),
      })
      return nutrition.foodId(created.id)
    },
    async edit(id, { name, place, servingLabel, perServing, estimated }) {
      const cleared = (value: string | null) => (value === null ? deleteField() : value)
      const ref = doc(foods, id)
      await runTransaction(db, async (transaction) => {
        if (!isLive(await transaction.get(ref))) throw new Error(`No such Food: ${id}`)
        transaction.update(ref, {
          ...(name === undefined ? {} : { name }),
          ...(place === undefined ? {} : { place: cleared(place) }),
          ...(servingLabel === undefined ? {} : { servingLabel: cleared(servingLabel) }),
          ...(perServing === undefined ? {} : { perServing }),
          ...(estimated === undefined ? {} : { estimated: estimated ? true : deleteField() }),
        })
      })
    },
    async softDelete(id) {
      const ref = doc(foods, id)
      await runTransaction(db, async (transaction) => {
        if (!isLive(await transaction.get(ref))) throw new Error(`No such Food: ${id}`)
        transaction.update(ref, { deletedAt: serverTimestamp() })
      })
    },
  }
}

/** Whether the document exists and has not been soft-deleted. */
function isLive(snapshot: DocumentSnapshot): boolean {
  return snapshot.exists() && snapshot.data().deletedAt === undefined
}
