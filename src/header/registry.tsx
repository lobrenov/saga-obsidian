import type { ComponentType } from 'react'
import type { RendererDef } from '../shared/renderers/define'
import { rendererDefs } from '../shared/renderers/definitions'
import { readFrontmatter } from '../shared/schemas/frontmatter'
import type { Validated } from '../shared/result'
import { FieldView } from './FieldView'
import { CharacterLayout, DocumentLayout, FactionLayout, ItemLayout, LocationLayout, MapLayout } from './layouts'
import type { HeaderRendererId, LayoutInput, LayoutProps, RegisteredRenderer } from './types'

/** Pairs a shared renderer definition with its layout; the returned `Layout` validates the note's frontmatter and hands the layout its field editors. */
function defineRendererView<R extends RendererDef>(def: R, Layout: ComponentType<LayoutProps<R>>): RegisteredRenderer {
  function TypedLayout({ title, frontmatter, keys }: LayoutInput) {
    const layers = readFrontmatter(def, frontmatter, keys).fields as Record<string, Validated<unknown>>
    const field: LayoutProps<R>['field'] = (name, className) => {
      const fieldDef = def.fields[name]
      const layer = layers[name]
      if (!fieldDef || !layer) return null
      const noteKey = keys[name] ?? fieldDef.key
      return <FieldView key={name} def={fieldDef} noteKey={noteKey} raw={frontmatter[noteKey]} layer={layer} className={className} />
    }
    return <Layout title={title} field={field} />
  }
  return { Layout: TypedLayout }
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
