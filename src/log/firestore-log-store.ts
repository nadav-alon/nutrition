import {
  Timestamp,
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type Transaction,
} from 'firebase/firestore'
import type { core } from 'data-platform'
import { nutrition } from 'data-platform'
import { applyEdit } from './apply-edit.ts'
import { servings } from './servings.ts'
import { unsyncedEntry } from './unsynced-entry.ts'
import type { LogEntry, LogStore, NewLogEntry } from './log-store.ts'

/** The Firestore adapter for `LogStore`: `nutritionLogs/{uid}/entries`, one document per Log Entry. */
export function firestoreLogStore(db: Firestore, uid: core.Uid): LogStore {
  const entries = collection(db, nutrition.NUTRITION_LOGS_COLLECTION, uid, nutrition.LOG_ENTRIES_COLLECTION)

  return {
    watchDay(start, end, onEntries, onError) {
      const day = query(
        entries,
        where('eatenAt', '>=', Timestamp.fromDate(start)),
        where('eatenAt', '<', Timestamp.fromDate(end)),
        orderBy('eatenAt'),
      )
      return onSnapshot(
        day,
        (snapshot) => {
          let live: LogEntry[]
          try {
            live = snapshot.docs.filter(isLive).map(toLogEntry)
          } catch (error) {
            // A malformed document must reach the caller, not throw inside the SDK's callback.
            onError?.(error instanceof Error ? error : new Error(String(error)))
            return
          }
          onEntries(live)
        },
        onError,
      )
    },
    async recent(count) {
      const live: LogEntry[] = []
      let after: QueryDocumentSnapshot | undefined
      while (live.length < count) {
        const page = query(entries, orderBy('eatenAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(count))
        const { docs } = await getDocs(page)
        live.push(...docs.filter(isLive).map(toLogEntry))
        if (docs.length < count) break
        after = docs[docs.length - 1]
      }
      return live.slice(0, count)
    },
    async create(entry: NewLogEntry) {
      const created = await addDoc(entries, toDocument(entry))
      return nutrition.logEntryId(created.id)
    },
    async update(id, edit) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        const snapshot = await getLive(transaction, ref)
        if (!snapshot) throw new Error(`No live Log Entry ${id}`)
        const current = toLogEntry(snapshot)
        const edited = applyEdit(current, edit)
        transaction.update(ref, {
          servings: edited.servings,
          mealType: edited.mealType,
          eatenAt: Timestamp.fromDate(edited.eatenAt),
          nutrition: edited.nutrition,
          ...(edited.googleHealthStale && { googleHealthStale: true }),
        })
      })
    },
    async softDelete(id) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        if (!(await getLive(transaction, ref))) return
        transaction.update(ref, { deletedAt: serverTimestamp() })
      })
    },
    async recordPushed(id, googleHealthId) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        if (!(await transaction.get(ref)).exists()) throw new Error(`No Log Entry ${id}`)
        transaction.update(ref, { googleHealthId, googleHealthStale: deleteField() })
      })
    },
    async recordRemoved(id) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        if (!(await transaction.get(ref)).exists()) throw new Error(`No Log Entry ${id}`)
        transaction.update(ref, { googleHealthId: deleteField(), googleHealthStale: deleteField() })
      })
    },
    async unsynced() {
      // Firestore cannot query for an absent field, so every entry is read and the outstanding ones kept.
      const { docs } = await getDocs(query(entries, orderBy('eatenAt')))
      return docs.flatMap((snapshot) => unsyncedEntry(toLogEntry(snapshot), !isLive(snapshot)) ?? [])
    },
  }
}

/** The entry's snapshot inside `transaction`, or `undefined` when it does not exist or is deleted. */
async function getLive(transaction: Transaction, ref: DocumentReference): Promise<DocumentSnapshot | undefined> {
  const snapshot = await transaction.get(ref)
  return snapshot.exists() && isLive(snapshot) ? snapshot : undefined
}

/** Only the `NewLogEntry` fields are written, whatever else the argument carries. */
function toDocument(entry: NewLogEntry): DocumentData {
  return {
    name: entry.name,
    source: entry.source,
    nutrition: entry.nutrition,
    servings: entry.servings,
    mealType: entry.mealType,
    eatenAt: Timestamp.fromDate(entry.eatenAt),
    ...(entry.estimated && { estimated: true }),
  }
}

function toLogEntry(snapshot: DocumentSnapshot): LogEntry {
  const data = nutrition.logEntrySchema.parse(snapshot.data())
  const { eatenAt } = data
  return {
    id: nutrition.logEntryId(snapshot.id),
    name: data.name,
    source: data.source,
    nutrition: data.nutrition,
    servings: servings(data.servings),
    mealType: data.mealType,
    eatenAt: eatenAt instanceof Date ? eatenAt : new Timestamp(eatenAt.seconds, eatenAt.nanoseconds).toDate(),
    ...(data.estimated && { estimated: true as const }),
    ...(data.googleHealthId === undefined ? {} : { googleHealthId: data.googleHealthId }),
    ...(data.googleHealthStale === true ? { googleHealthStale: true as const } : {}),
  }
}

/** Whether a stored entry is live: it has no `deletedAt`. */
function isLive(snapshot: DocumentSnapshot): boolean {
  return snapshot.get('deletedAt') === undefined
}
