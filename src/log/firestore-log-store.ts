import {
  Timestamp,
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { nutrition } from 'data-platform'
import type { core } from 'data-platform'
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
      return onSnapshot(day, (snapshot) => onEntries(snapshot.docs.map(toRecord)), onError)
    },
    async create(entry: NewLogEntry) {
      const created = await addDoc(entries, toDocument(entry))
      return nutrition.logEntryId(created.id)
    },
  }
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
