import { TopAppBarNavigation } from 'household-ui/shell/TopAppBar.tsx'
import { IconButton } from 'household-ui/ui/IconButton.tsx'
import ArrowBack from '~icons/material-symbols/arrow-back'

/** A screen's one Back: an arrow in the top app bar's leading slot, shown for as long as the screen is. */
export function BackArrow({ onClick }: { onClick: () => void }) {
  return (
    <TopAppBarNavigation>
      <IconButton symbol={ArrowBack} label="Back" onClick={onClick} />
    </TopAppBarNavigation>
  )
}
