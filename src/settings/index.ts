import { Notice, PluginSettingTab, Setting, type App, type Plugin } from 'obsidian'
import type { ConfigStore } from '../obsidian/vault'
import { rendererDefs } from '../shared/renderers/definitions'
import type { Fields } from '../shared/renderers/fields'
import type { Issue } from '../shared/result'
import type { Config } from '../shared/schemas/config'
import { draftIssues, draftOf, EDITABLE_IDS, isDirty, rebase, saveText, type Draft } from './draft'

class SettingsTab extends PluginSettingTab {
  private draft: Draft
  private unsubscribe: (() => void) | null = null
  private loaded: Config
  private changedOnDisk = false

  constructor(
    app: App,
    plugin: Plugin,
    private readonly config: ConfigStore
  ) {
    super(app, plugin)
    this.loaded = config.state().config
    this.draft = draftOf(this.loaded)
  }

  override display(): void {
    this.unsubscribe?.()
    this.unsubscribe = this.config.subscribe((state) => {
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
  }

  private render(): void {
    const { containerEl } = this
    containerEl.empty()
    const issuesEl = containerEl.createDiv()
    const showIssues = (issues: readonly Issue[]): void => {
      issuesEl.empty()
      for (const issue of issues) {
        const line = issuesEl.createDiv({ text: issue.path ? `${issue.path}: ${issue.message}` : issue.message })
        line.style.color = 'var(--text-error)'
      }
    }
    const state = this.config.state()
    const validate = (): void => showIssues(draftIssues(this.draft, state.config))
    showIssues(state.issues)
    if (this.changedOnDisk) containerEl.insertBefore(createDiv({ text: 'renderers.yaml changed on disk; your edits are kept and saved over the new text.' }), issuesEl)

    new Setting(containerEl)
      .setName('Type key')
      .setDesc('The frontmatter key whose value picks a note’s renderer. Saved to .saga/renderers.yaml.')
      .addText((text) =>
        text.setValue(this.draft.typeKey).onChange((value) => {
          this.draft.typeKey = value
          validate()
        })
      )

    for (const id of EDITABLE_IDS) {
      const def = rendererDefs[id]
      new Setting(containerEl).setName(def.label).setHeading()
      const readOnly = state.invalid.includes(id)
      if (readOnly) containerEl.createDiv({ text: 'This entry in renderers.yaml could not be read; fix it in the file.' }).style.color = 'var(--text-error)'
      new Setting(containerEl)
        .setName('Types')
        .setDesc('Comma-separated values of the type key.')
        .addText((text) =>
          text
            .setValue(this.draft.types[id] ?? '')
            .setDisabled(readOnly)
            .onChange((value) => {
              this.draft.types[id] = value
              validate()
            })
        )
      for (const [field, fieldDef] of Object.entries(def.fields as Fields)) {
        new Setting(containerEl)
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
                validate()
              })
          )
      }
    }
    new Setting(containerEl).setName('Document').setHeading()
    containerEl.createDiv({ text: 'The fallback: any note whose type is not mapped above.' })

    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText('Save')
        .setCta()
        .onClick(() => void this.save(showIssues))
    )
  }

  private async save(showIssues: (issues: readonly Issue[]) => void): Promise<void> {
    const result = saveText(this.config.state(), this.draft)
    if (!result.ok) {
      showIssues(result.error.kind === 'validation' ? result.error.issues : [{ path: '', message: result.error.message }])
      return
    }
    try {
      await this.config.writeConfig(result.value)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      showIssues([{ path: '', message: `Could not write renderers.yaml: ${message}` }])
      new Notice(`Saga: could not write renderers.yaml: ${message}`)
      return
    }
    this.loaded = this.config.state().config
    this.draft = draftOf(this.loaded)
    this.changedOnDisk = false
    this.render()
  }
}

/** Adds the settings tab, editing `.saga/renderers.yaml` through `config`. */
export function registerSettings(plugin: Plugin, config: ConfigStore): void {
  plugin.addSettingTab(new SettingsTab(plugin.app, plugin, config))
}
