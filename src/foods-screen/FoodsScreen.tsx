import { useEffect, useState } from 'preact/hooks'
import { ListRow } from 'household-ui/ui/ListRow.tsx'
import { errorMessage } from '../error-message.ts'
import type { Foods, SavedFood } from '../foods/foods.ts'

export interface FoodsScreenProps {
  foods: Foods
}

/** The supporting line of a Food's row: its place, when it has one, then the kcal of one Serving. */
function supportingLine(food: SavedFood): string {
  const kcal = `${Math.round(food.perServing.kcal * 10) / 10} kcal`
  return food.place === undefined ? kcal : `${food.place} · ${kcal}`
}

/** The Household's Foods: listed by name with place and per-Serving kcal, Estimated ones marked. */
export function FoodsScreen({ foods }: FoodsScreenProps) {
  const [list, setList] = useState<readonly SavedFood[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    return foods.watch(setList, (error) => setListError(errorMessage(error, 'Could not load Foods.')))
  }, [foods])

  if (listError !== null) return <main class="screen foods" role="alert">{listError}</main>
  if (list === null) return <main class="screen foods" />
  return (
    <main class="screen foods">
      {list.length === 0 ? (
        <p>No Foods yet.</p>
      ) : (
        <ul class="food-list">
          {list.map((food) => (
            <ListRow
              key={food.id}
              headline={food.name}
              supporting={supportingLine(food)}
              trailing={food.estimated ? <span>Estimated</span> : undefined}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
