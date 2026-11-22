import { FuzzySuggestModal, setIcon, type App } from 'obsidian'
import { PIN_ICONS, type PinIconDef } from '../shared/pins/look'

/** Picks a pin icon from the catalogue, matching on label and id; calls `onChoose` with the chosen id. */
export class IconPicker extends FuzzySuggestModal<PinIconDef> {
  constructor(
    app: App,
    private readonly onChoose: (id: string) => void
  ) {
    super(app)
    this.setPlaceholder('Choose an icon')
  }

  getItems(): PinIconDef[] {
    return [...PIN_ICONS]
  }

  getItemText(item: PinIconDef): string {
    return `${item.label} ${item.id}`
  }

  override renderSuggestion(match: { item: PinIconDef }, el: HTMLElement): void {
    el.addClass('saga-icon-choice')
    setIcon(el.createSpan({ cls: 'saga-icon-choice-icon' }), match.item.id)
    el.createSpan({ text: match.item.label })
  }

  onChooseItem(item: PinIconDef): void {
    this.onChoose(item.id)
  }
}
