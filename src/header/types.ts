import type { ComponentType, ReactNode } from 'react'
import type { Fields } from '../shared/renderers/fields'

/** What a renderer's `Layout` receives: the note's title and a per-field editor. */
export interface LayoutProps<R extends { fields: Fields }> {
  title: ReactNode
  /** The field's editor, or its raw value with a Convert action when the value fails the schema. */
  field: (name: keyof R['fields'] & string, className?: string) => ReactNode
}

/** What the header gives a registered renderer; the registry turns it into typed `LayoutProps`. */
export interface LayoutInput {
  title: ReactNode
  frontmatter: Readonly<Record<string, unknown>>
  /** Field name -> note key, from the config's renames. */
  keys: Readonly<Record<string, string>>
}

export type HeaderRendererId = 'character' | 'location' | 'faction' | 'item' | 'map' | 'document'

export interface RegisteredRenderer {
  Layout: ComponentType<LayoutInput>
  /** The same layout with read-only fields, for PDF export. */
  PrintLayout: ComponentType<LayoutInput>
}
