import { Notice, PluginSettingTab, setIcon, Setting, type App, type Plugin } from 'obsidian'
import type { PinLabels, PrefsStore } from '../obsidian/prefs'
import { frontmatterOf, type ConfigStore } from '../obsidian/vault'
import { PIN_COLORS, PIN_DEFAULTS, SHAPES, type ColorId, type PinLook, type ShapeId } from '../shared/pins/look'
import { rendererDefs } from '../shared/renderers/definitions'
import type { Fields } from '../shared/renderers/fields'
import type { Issue } from '../shared/result'
import type { Config } from '../shared/schemas/config'
import { RENDERER_IDS, type RendererId } from '../shared/renderers/ids'
import { IconPicker } from '../ui/iconPicker'
import { draftIssues, draftOf, EDITABLE_IDS, isDirty, rebase, saveText, type Draft } from './draft'
import { drawPinPreview } from './pinPreview'
import './settings.css'

class SettingsTab extends PluginSettingTab {
  private draft: Draft
  private unsubscribe: (() => void) | null = null
  private loaded: Config
  private changedOnDisk = false
  /** Renderer sections the user has expanded, kept across re-renders. */
  private readonly expanded = new Set<RendererId>()
  private issuesEl: HTMLElement | null = null
  private pending: number | null = null

  constructor(
    app: App,
    plugin: Plugin,
    private readonly config: ConfigStore,
    private readonly prefs: PrefsStore
  ) {
    super(app, plugin)
    this.loaded = config.state().config
    this.draft = draftOf(this.loaded)
  }

  override display(): void {
    this.unsubscribe?.()
    this.unsubscribe = this.config.subscribe((state) => {
      // The tab's own save: the inputs already show it, so keep focus and leave them.
      if (!isDirty(this.draft, state.config)) {
        this.loaded = state.config
        return
      }
      this.changedOnDisk = isDirty(this.draft, this.loaded)
      this.draft = rebase(this.draft, this.loaded, state.config)
      this.loaded = state.config
      this.render()
    })
    this.loaded = this.config.state().config
    this.draft = draftOf(this.loaded)
    this.changedOnDisk = false
    this.render()
  }

  override hide(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.pending !== null) void this.save()
  }

  private showIssues(issues: readonly Issue[]): void {
    const el = this.issuesEl
    if (!el) return
    el.empty()
    for (const issue of issues) el.createDiv({ cls: 'saga-settings-issue', text: issue.path ? `${issue.path}: ${issue.message}` : issue.message })
  }

  /** Shows the draft's issues and saves it 600 ms after the last edit. */
  private changed(): void {
    this.showIssues(draftIssues(this.draft, this.config.state().config))
    if (this.pending !== null) window.clearTimeout(this.pending)
    this.pending = window.setTimeout(() => void this.save(), 600)
  }

  private render(): void {
    const { containerEl } = this
    containerEl.empty()
    this.issuesEl = containerEl.createDiv()
    const state = this.config.state()
    this.showIssues(state.issues)
    if (this.changedOnDisk) containerEl.insertBefore(createDiv({ text: 'renderers.yaml changed on disk; your edits are kept and saved over the new text.' }), this.issuesEl)

    new Setting(containerEl).setName('Maps').setHeading()
    new Setting(containerEl)
      .setName('Pin labels')
      .setDesc('When map pins show their note’s name.')
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ always: 'Always', hover: 'On hover' })
          .setValue(this.prefs.get().pinLabels)
          .onChange((value) => void this.prefs.set({ pinLabels: value as PinLabels }))
      )

    new Setting(containerEl).setName('Markdown rendering').setHeading()
    new Setting(containerEl)
      .setName('Render icons with wikilinks?')
      .setDesc('Wikilinks in note text show an icon for the linked note.')
      .addToggle((toggle) =>
        toggle.setValue(this.prefs.get().linkIcons).onChange((value) => {
          iconLook.settingEl.toggle(value || this.prefs.get().fileIcons)
          void this.prefs.set({ linkIcons: value })
        })
      )
    const iconLook = new Setting(containerEl)
      .setName('Icon look')
      .setDesc('For wikilink and file icons: always the renderer’s icon and colour, or the icon and colour of the note’s pin on a map, falling back to the renderer’s.')
      .addDropdown((dropdown) => {
        const maps = this.app.vault
          .getMarkdownFiles()
          .filter((file) => this.config.rendererOf(frontmatterOf(this.app, file)).renderer === 'map')
          .sort((a, b) => a.basename.localeCompare(b.basename))
        const look = this.prefs.get().linkIconLook
        dropdown
          .addOptions({ renderer: 'Renderer', ...Object.fromEntries(maps.map((map) => [map.path, map.basename])) })
          .setValue(maps.some((map) => map.path === look) ? look : 'renderer')
          .onChange((value) => void this.prefs.set({ linkIconLook: value }))
      })
    iconLook.settingEl.toggle(this.prefs.get().linkIcons || this.prefs.get().fileIcons)
    new Setting(containerEl)
      .setName('Render character titles with wikilinks?')
      .setDesc('Wikilinks to characters read “Name, Title” when the character has a title.')
      .addToggle((toggle) => toggle.setValue(this.prefs.get().linkTitles).onChange((value) => void this.prefs.set({ linkTitles: value })))

    new Setting(containerEl).setName('File explorer').setHeading()
    new Setting(containerEl)
      .setName('Render file icons?')
      .setDesc('The file explorer shows an icon before each folder and typed note, in the Icon look.')
      .addToggle((toggle) =>
        toggle.setValue(this.prefs.get().fileIcons).onChange((value) => {
          iconLook.settingEl.toggle(value || this.prefs.get().linkIcons)
          untyped.setDisabled(!value)
          void this.prefs.set({ fileIcons: value })
        })
      )
    const untyped = new Setting(containerEl)
      .setName('Render icons for untyped files?')
      .setDesc('Notes with no renderer type show the Document icon.')
      .addToggle((toggle) => toggle.setValue(this.prefs.get().fileIconsUntyped).onChange((value) => void this.prefs.set({ fileIconsUntyped: value })))
      .setDisabled(!this.prefs.get().fileIcons)

    new Setting(containerEl).setName('Renderers').setHeading()
    new Setting(containerEl)
      .setName('Type key')
      .setDesc('The frontmatter key whose value picks a note’s renderer. Saved to .saga/renderers.yaml.')
      .addText((text) =>
        text.setValue(this.draft.typeKey).onChange((value) => {
          this.draft.typeKey = value
          this.changed()
        })
      )

    for (const id of EDITABLE_IDS) {
      const def = rendererDefs[id]
      const section = containerEl.createEl('details', { cls: 'saga-settings-renderer' })
      section.open = this.expanded.has(id)
      section.addEventListener('toggle', () => (section.open ? this.expanded.add(id) : this.expanded.delete(id)))
      const summary = section.createEl('summary')
      summary.createSpan({ cls: 'saga-settings-renderer-name', text: def.label })
      const typesEl = summary.createSpan({ cls: 'saga-settings-renderer-types', text: this.draft.types[id] || id })
      const readOnly = state.invalid.includes(id)
      if (readOnly) section.createDiv({ cls: 'saga-settings-issue', text: 'This entry in renderers.yaml could not be read; fix it in the file.' })
      new Setting(section)
        .setName('Types')
        .setDesc('Comma-separated values of the type key.')
        .addText((text) =>
          text
            .setValue(this.draft.types[id] ?? '')
            .setDisabled(readOnly)
            .onChange((value) => {
              this.draft.types[id] = value
              typesEl.setText(value || id)
              this.changed()
            })
        )
      for (const [field, fieldDef] of Object.entries(def.fields as Fields)) {
        new Setting(section)
          .setName(fieldDef.label)
          .setDesc(`Key in your notes (default ${fieldDef.key})`)
          .addText((text) =>
            text
              .setPlaceholder(fieldDef.key)
              .setValue(this.draft.keys[id]?.[field] ?? '')
              .setDisabled(readOnly)
              .onChange((value) => {
                const keys = (this.draft.keys[id] ??= {})
                keys[field] = value
                this.changed()
              })
          )
      }
    }
    const fallback = containerEl.createDiv({ cls: 'saga-settings-renderer saga-settings-fallback' })
    fallback.createSpan({ cls: 'saga-settings-renderer-name', text: rendererDefs.document.label })
    fallback.createSpan({ cls: 'saga-settings-renderer-types', text: 'any other type' })

    new Setting(containerEl).setName('Pin defaults').setDesc('The shape, colour and icon of a renderer’s map pins. A pin’s own settings win.').setHeading()
    for (const id of RENDERER_IDS) this.renderPinRow(id, state.invalid.includes(id))
  }

  /** One renderer's pin defaults: preview, Shape, Colour, Icon and Reset; edits update the row in place. */
  private renderPinRow(id: RendererId, readOnly: boolean): void {
    const look = (): PinLook => (this.draft.pin[id] ??= { ...PIN_DEFAULTS[id] })
    const setting = new Setting(this.containerEl).setName(rendererDefs[id].label)
    const preview = createDiv({ cls: 'saga-pin-preview' })
    setting.controlEl.prepend(preview)
    let reset: HTMLElement | undefined
    let shape: { setValue: (value: string) => unknown } | undefined
    let color: { setValue: (value: string) => unknown } | undefined
    let iconButton: HTMLElement | undefined
    const refresh = (): void => {
      drawPinPreview(preview, look())
      if (iconButton) setIcon(iconButton, look().icon)
      const { shape: s, color: c, icon: i } = PIN_DEFAULTS[id]
      reset?.toggleClass('saga-pin-reset-hidden', look().shape === s && look().color === c && look().icon === i)
    }
    const edit = (change: Partial<PinLook>): void => {
      this.draft.pin[id] = { ...look(), ...change }
      refresh()
      this.changed()
    }
    setting
      .addDropdown((dropdown) => {
        shape = dropdown
        dropdown
          .addOptions(Object.fromEntries(SHAPES.map((entry) => [entry.id, entry.label])))
          .setValue(look().shape)
          .setDisabled(readOnly)
          .onChange((value) => edit({ shape: value as ShapeId }))
      })
      .addDropdown((dropdown) => {
        color = dropdown
        dropdown
          .addOptions(Object.fromEntries(PIN_COLORS.map((entry) => [entry.id, entry.name])))
          .setValue(look().color)
          .setDisabled(readOnly)
          .onChange((value) => edit({ color: value as ColorId }))
      })
      .addExtraButton((button) => {
        iconButton = button.extraSettingsEl
        button
          .setTooltip('Icon')
          .setDisabled(readOnly)
          .onClick(() => new IconPicker(this.app, (icon) => edit({ icon })).open())
      })
      .addExtraButton((button) => {
        reset = button.extraSettingsEl
        button.setIcon('rotate-ccw').setTooltip('Reset to default').setDisabled(readOnly).onClick(() => {
          this.draft.pin[id] = { ...PIN_DEFAULTS[id] }
          shape?.setValue(PIN_DEFAULTS[id].shape)
          color?.setValue(PIN_DEFAULTS[id].color)
          refresh()
          this.changed()
        })
      })
    refresh()
  }

  /** Writes the draft when it is valid; a refused draft shows its issues and writes nothing. */
  private async save(): Promise<void> {
    if (this.pending !== null) window.clearTimeout(this.pending)
    this.pending = null
    const result = saveText(this.config.state(), this.draft)
    if (!result.ok) {
      this.showIssues(result.error.kind === 'validation' ? result.error.issues : [{ path: '', message: result.error.message }])
      return
    }
    try {
      await this.config.writeConfig(result.value)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.showIssues([{ path: '', message: `Could not write renderers.yaml: ${message}` }])
      new Notice(`Saga: could not write renderers.yaml: ${message}`)
      return
    }
    this.loaded = this.config.state().config
    this.showIssues(this.config.state().issues)
    if (this.changedOnDisk) {
      this.changedOnDisk = false
      this.render()
    }
  }
}

/** Adds the settings tab, editing `.saga/renderers.yaml` through `config`. */
export function registerSettings(plugin: Plugin, config: ConfigStore, prefs: PrefsStore): void {
  plugin.addSettingTab(new SettingsTab(plugin.app, plugin, config, prefs))
}
