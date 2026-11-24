import {
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { core } from 'data-platform'
import { nutrition } from 'data-platform'
import type { LogEntryRecord, LogStore, NewLogEntry } from './log-store.ts'

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
      return onSnapshot(day, (snapshot) => onEntries(snapshot.docs.filter(isLiveDoc).map(toRecord)), onError)
    },
    async create(entry: NewLogEntry) {
      const created = await addDoc(entries, toDocument(entry))
      return nutrition.logEntryId(created.id)
    },
    async softDelete(id) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref)
        if (!snapshot.exists() || !isLive(snapshot.data())) return
        transaction.update(ref, { deletedAt: serverTimestamp() })
      })
    },
  }
}

/** Whether a stored entry is live: it has no `deletedAt`. */
function isLiveDoc(snapshot: QueryDocumentSnapshot): boolean {
  return isLive(snapshot.data())
}

function toDocument(entry: NewLogEntry): DocumentData {
  return { ...entry, eatenAt: Timestamp.fromDate(entry.eatenAt) }
}

function toRecord(snapshot: QueryDocumentSnapshot): LogEntryRecord {
  const data = nutrition.logEntrySchema.parse(snapshot.data())
  const { eatenAt } = data
  return {
    id: nutrition.logEntryId(snapshot.id),
    name: data.name,
    source: data.source,
    nutrition: data.nutrition,
    servings: data.servings,
    mealType: data.mealType,
    eatenAt: eatenAt instanceof Date ? eatenAt : new Timestamp(eatenAt.seconds, eatenAt.nanoseconds).toDate(),
  }
}

/** Whether stored data is live: `deletedAt` is absent. */
function isLive(data: DocumentData): boolean {
  return data.deletedAt === undefined
}
