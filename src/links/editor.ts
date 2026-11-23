import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateEffect, type Extension } from '@codemirror/state'
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { editorInfoField, editorLivePreviewField, setIcon } from 'obsidian'
import type { LinkIcon, LinkMarks } from './renderers'
import { wikilinksIn } from './syntax'

export type MarksOf = (target: string, fromPath: string) => LinkMarks

/** Redraws the link icons and titles of an editor. */
export const refreshLinkIcons = StateEffect.define<null>()

/** The icon drawn before a link, coloured by its pin colour's `--saga-pin-<colour>` token, else its renderer's `--saga-<renderer>` token. */
export function linkIcon(icon: LinkIcon): HTMLElement {
  const el = createSpan({ cls: 'saga-link-icon' })
  el.dataset.renderer = icon.renderer
  if (icon.color) el.dataset.color = icon.color
  el.setAttribute('aria-hidden', 'true')
  setIcon(el, icon.icon)
  return el
}

/** The `, Title` drawn after a link to a character. */
export function linkTitle(title: string): HTMLElement {
  return createSpan({ cls: 'saga-link-title', text: `, ${title}` })
}

class LinkIconWidget extends WidgetType {
  constructor(readonly icon: LinkIcon) {
    super()
  }
  override eq(other: LinkIconWidget): boolean {
    return other.icon.renderer === this.icon.renderer && other.icon.icon === this.icon.icon && other.icon.color === this.icon.color
  }
  override toDOM(): HTMLElement {
    return linkIcon(this.icon)
  }
}

class LinkTitleWidget extends WidgetType {
  constructor(readonly title: string) {
    super()
  }
  override eq(other: LinkTitleWidget): boolean {
    return other.title === this.title
  }
  override toDOM(): HTMLElement {
    return linkTitle(this.title)
  }
}

/** Live Preview: an icon widget before and a title widget after each visible wikilink that has them. `editors` holds the open editors, for `refreshLinkIcons`. */
export function linkIconsExtension(marksOf: MarksOf, editors: Set<EditorView>): Extension {
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
        let last = -1
        for (const { from, to } of this.view.visibleRanges) {
          for (const link of wikilinksIn(state, from, to)) {
            // A link across two visible ranges is found in both.
            if (link.from <= last) continue
            last = link.from
            const { icon, title } = marksOf(link.target, path)
            if (icon) builder.add(link.from, link.from, Decoration.widget({ widget: new LinkIconWidget(icon), side: -1 }))
            if (title) builder.add(link.to, link.to, Decoration.widget({ widget: new LinkTitleWidget(title), side: 1 }))
          }
        }
        return builder.finish()
      }
    },
    { decorations: (plugin) => plugin.decorations }
  )
}
