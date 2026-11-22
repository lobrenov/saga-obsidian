import { Icon } from '../header/Icon'
import { BANNER_KEY } from '../shared/renderers/banner'
import { useBannerPicker } from './useBannerPicker'

/** The muted "+ Add banner" button under the title of a note without a renderer; picking an image writes `banner`. */
export function AddBanner() {
  const { picking, open, trigger, popover, alert } = useBannerPicker(BANNER_KEY)
  return (
    <div className="saga-banner-add">
      <button ref={trigger} type="button" className="saga-banner-add-button" aria-expanded={picking} onClick={open}>
        <Icon name="image-plus" />
        Add banner
      </button>
      {popover}
      {alert}
    </div>
  )
}
