import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { editorInfoField, editorLivePreviewField, setIcon } from 'obsidian'
import { rendererDefs } from '../shared/renderers/definitions'
import type { RendererId } from '../shared/renderers/ids'
import { wikilinksIn } from './syntax'

export type RendererOf = (target: string, fromPath: string) => RendererId | null

/** Redraws the link icons of an editor. */
export const refreshLinkIcons = StateEffect.define<null>()

/** The icon drawn before a link: the renderer's icon, coloured by its `--saga-<renderer>` token. */
export function linkIcon(doc: Document, renderer: RendererId): HTMLElement {
  const el = doc.createElement('span')
  el.className = 'saga-link-icon'
  el.dataset.renderer = renderer
  el.setAttribute('aria-hidden', 'true')
  setIcon(el, rendererDefs[renderer].icon)
  return el
}

class LinkIconWidget extends WidgetType {
  constructor(readonly renderer: RendererId) {
    super()
  }
  override eq(other: LinkIconWidget): boolean {
    return other.renderer === this.renderer
  }
  override toDOM(view: EditorView): HTMLElement {
    return linkIcon(view.dom.ownerDocument, this.renderer)
  }
}

/** Live Preview: an icon widget before each visible wikilink whose note has a renderer. `editors` holds the open editors, for `refreshLinkIcons`. */
export function linkIconsExtension(rendererOf: RendererOf, editors: Set<EditorView>): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(readonly view: EditorView) {
        editors.add(view)
        this.decorations = this.build()
      }
      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.startState) !== syntaxTree(update.state) ||
          update.startState.field(editorLivePreviewField, false) !== update.state.field(editorLivePreviewField, false) ||
          update.transactions.some((tr) => tr.effects.some((effect) => effect.is(refreshLinkIcons)))
        )
          this.decorations = this.build()
      }
      destroy(): void {
        editors.delete(this.view)
      }
      build(): DecorationSet {
        const { state } = this.view
        const path = state.field(editorInfoField, false)?.file?.path
        if (path === undefined || !state.field(editorLivePreviewField, false)) return Decoration.none
        const builder = new RangeSetBuilder<Decoration>()
        for (const { from, to } of this.view.visibleRanges) {
          for (const link of wikilinksIn(state, from, to)) {
            const renderer = rendererOf(link.target, path)
            if (renderer) builder.add(link.from, link.from, Decoration.widget({ widget: new LinkIconWidget(renderer), side: -1 }))
          }
        }
        return builder.finish()
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
