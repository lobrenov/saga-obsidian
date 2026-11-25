import type { ComponentType } from 'react'
import { dateEntries, readDate } from '../shared/calendars/dates'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import { readFrontmatter } from '../shared/schemas/frontmatter'
import type { Validated } from '../shared/result'
import { PrintField } from '../print/PrintField'
import { FieldView, type FieldViewProps } from './FieldView'
import { CalendarLayout } from './CalendarLayout'
import { CharacterLayout, DocumentLayout, FactionLayout, ItemLayout, LocationLayout, LoreLayout, LorePrintLayout, MapLayout } from './layouts'
import type { HeaderRendererId, LayoutInput, LayoutProps, RegisteredRenderer } from './types'

/** Pairs a shared renderer definition with its layout; `Layout` validates the note's frontmatter and hands the layout its field editors, `PrintLayout` its read-only fields. */
function defineRendererView<R extends RendererDef>(def: R, Layout: ComponentType<LayoutProps<R>>): RegisteredRenderer {
  const layoutWith =
    (View: ComponentType<FieldViewProps>) =>
    ({ title, frontmatter, keys, hidden }: LayoutInput) => {
      const layers = readFrontmatter(def, frontmatter, keys).fields as Record<string, Validated<unknown>>
      const field: LayoutProps<R>['field'] = (name, className) => {
        const fieldDef = def.fields[name]
        const layer = layers[name]
        if (!fieldDef || !layer || hidden.includes(name)) return null
        if (fieldDef.kind === 'date') {
          const entries = dateEntries(frontmatter, fieldDef.prefix)
          const date = readDate(frontmatter, fieldDef.prefix)
          return <View key={name} def={fieldDef} noteKey={fieldDef.key} raw={Object.keys(entries).length > 0 ? entries : undefined} layer={date} frontmatter={frontmatter} className={className} />
        }
        const noteKey = keys[name] ?? fieldDef.key
        return <View key={name} def={fieldDef} noteKey={noteKey} raw={frontmatter[noteKey]} layer={layer} frontmatter={frontmatter} className={className} />
      }
      return <Layout title={title} field={field} />
    }
  return { Layout: layoutWith(FieldView), PrintLayout: layoutWith(PrintField) }
}

const { character, location, faction, item, map, calendar, lore, document } = rendererDefs

/** Every renderer's header layout. */
export const rendererRegistry: Record<HeaderRendererId, RegisteredRenderer> = {
  character: defineRendererView(character, CharacterLayout),
  location: defineRendererView(location, LocationLayout),
  faction: defineRendererView(faction, FactionLayout),
  item: defineRendererView(item, ItemLayout),
  map: defineRendererView(map, MapLayout),
  calendar: { Layout: CalendarLayout, PrintLayout: defineRendererView(calendar, DocumentLayout).PrintLayout },
  lore: { Layout: defineRendererView(lore, LoreLayout).Layout, PrintLayout: defineRendererView(lore, LorePrintLayout).PrintLayout },
  document: defineRendererView(document, DocumentLayout)
}
