import type { ComponentType } from 'react'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import { readFrontmatter } from '../shared/schemas/frontmatter'
import type { Validated } from '../shared/result'
import { PrintField } from '../print/PrintField'
import { FieldView, type FieldViewProps } from './FieldView'
import { CharacterLayout, DocumentLayout, FactionLayout, ItemLayout, LocationLayout, MapLayout } from './layouts'
import type { HeaderRendererId, LayoutInput, LayoutProps, RegisteredRenderer } from './types'

/** Pairs a shared renderer definition with its layout; `Layout` validates the note's frontmatter and hands the layout its field editors, `PrintLayout` its read-only fields. */
function defineRendererView<R extends RendererDef>(def: R, Layout: ComponentType<LayoutProps<R>>): RegisteredRenderer {
  const layoutWith =
    (View: ComponentType<FieldViewProps>) =>
    ({ title, frontmatter, keys }: LayoutInput) => {
      const layers = readFrontmatter(def, frontmatter, keys).fields as Record<string, Validated<unknown>>
      const field: LayoutProps<R>['field'] = (name, className) => {
        const fieldDef = def.fields[name]
        const layer = layers[name]
        if (!fieldDef || !layer) return null
        const noteKey = keys[name] ?? fieldDef.key
        return <View key={name} def={fieldDef} noteKey={noteKey} raw={frontmatter[noteKey]} layer={layer} className={className} />
      }
      return <Layout title={title} field={field} />
    }
  return { Layout: layoutWith(FieldView), PrintLayout: layoutWith(PrintField) }
}

const { character, location, faction, item, map, document } = rendererDefs

/** Every renderer's header layout. */
export const rendererRegistry: Record<HeaderRendererId, RegisteredRenderer> = {
  character: defineRendererView(character, CharacterLayout),
  location: defineRendererView(location, LocationLayout),
  faction: defineRendererView(faction, FactionLayout),
  item: defineRendererView(item, ItemLayout),
  map: defineRendererView(map, MapLayout),
  document: defineRendererView(document, DocumentLayout)
}
