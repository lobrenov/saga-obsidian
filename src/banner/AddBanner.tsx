import { useState } from 'react'
import { Icon } from '../header/Icon'
import { BANNER_KEY } from '../shared/renderers/banner'
import { toNoteValue } from '../shared/renderers/values'
import { BannerPicker } from './BannerPicker'
import { useWrite } from './useWrite'

/** The muted "+ Add banner" button under the title of a note without a renderer; picking an image writes `banner`. */
export function AddBanner() {
  const { write, error } = useWrite()
  const [picking, setPicking] = useState(false)
  return (
    <div className="saga-banner-add">
      <button type="button" className="saga-banner-add-button" onClick={() => setPicking(true)}>
        <Icon name="image-plus" />
        Add banner
      </button>
      {picking ? (
        <BannerPicker
          onClose={() => setPicking(false)}
          onPick={(target) => {
            setPicking(false)
            void write(BANNER_KEY, toNoteValue({ target, embed: false }))
          }}
        />
      ) : null}
      {error ? <p role="alert" className="saga-banner-error">{error}</p> : null}
    </div>
  )
}
