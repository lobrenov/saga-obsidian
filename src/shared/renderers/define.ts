import type { FieldDef, FieldKind, FieldValue, Fields } from './fields'
import type { RendererId } from './ids'

/** The shared (React-free) part of a renderer; the renderer side extends it with `Layout` and `Card`. */
export interface RendererDef<Id extends RendererId = RendererId, F extends Fields = Fields> {
  id: Id
  label: string
  fields: F
  /** Icon name from the icon sprite. */
  icon: string
  /** Colour token name, without the `--saga-` prefix. */
  color: string
}

export function defineRenderer<const Id extends RendererId, const F extends Fields>(def: RendererDef<Id, F>): RendererDef<Id, F> {
  return def
}

/** Field name -> value; every field is optional, choice fields are literal unions. */
export type RendererValues<R extends { fields: Fields }> = { -readonly [K in keyof R['fields']]?: FieldValue<R['fields'][K]> }

/** Field name -> note key. */
export type KeyMap<R extends { fields: Fields }> = { -readonly [K in keyof R['fields']]: string }

type FieldOfKind<K extends FieldKind> = Extract<FieldDef, { kind: K }>

export interface EditorProps<K extends FieldKind> {
  field: FieldOfKind<K>
  value: FieldValue<FieldOfKind<K>> | undefined
  /** `undefined` clears the field. */
  onChange: (value: FieldValue<FieldOfKind<K>> | undefined) => void
}

/** One editor per field kind; a missing kind fails to compile. `Out` is the render result (a React node on the renderer side); `Ctx` is extra props every editor receives. */
export type FieldEditors<Out, Ctx = unknown> = { [K in FieldKind]: (props: EditorProps<K> & Ctx) => Out }
