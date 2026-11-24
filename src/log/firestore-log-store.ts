import {
  Timestamp,
  addDoc,
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { core } from 'data-platform'
import { nutrition } from 'data-platform'
import { applyEdit } from './apply-edit.ts'
import { servings } from './servings.ts'
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
      return onSnapshot(day, (snapshot) => onEntries(snapshot.docs.filter(isLiveDoc).map(toLogEntry)), onError)
    },
    async recent(limit) {
      const live: LogEntry[] = []
      let after: QueryDocumentSnapshot | undefined
      while (live.length < limit) {
        const page = query(entries, orderBy('eatenAt', 'desc'), ...(after ? [startAfter(after)] : []), fsLimit(limit))
        const { docs } = await getDocs(page)
        live.push(...docs.filter(isLiveDoc).map(toLogEntry))
        if (docs.length < limit) break
        after = docs[docs.length - 1]
      }
      return live.slice(0, limit)
    },
    async create(entry: NewLogEntry) {
      const created = await addDoc(entries, toDocument(entry))
      return nutrition.logEntryId(created.id)
    },
    async update(id, edit) {
      const ref = doc(entries, id)
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref)
        if (!snapshot.exists() || !isLive(snapshot.data())) throw new Error(`No live Log Entry ${id}`)
        const current = toLogEntry(snapshot)
        const edited = applyEdit(current, edit)
        transaction.update(ref, {
          servings: edited.servings,
          mealType: edited.mealType,
          eatenAt: Timestamp.fromDate(edited.eatenAt),
          nutrition: edited.nutrition,
        })
      })
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

function toLogEntry(snapshot: QueryDocumentSnapshot): LogEntry {
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
  }
}

/** Whether stored data is live: `deletedAt` is absent. */
function isLive(data: DocumentData): boolean {
  return data.deletedAt === undefined
}
