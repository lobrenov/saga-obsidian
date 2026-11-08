import { Plugin } from 'obsidian'
import { registerHeader } from './header'
import { registerMapView } from './map'
import { createPrefsStore } from './obsidian/prefs'
import { createConfigStore } from './obsidian/vault'
import { registerSettings } from './settings'
import './styles.css'

export default class SagaPlugin extends Plugin {
  override async onload(): Promise<void> {
    const config = await createConfigStore(this.app, this)
    const prefs = await createPrefsStore(this)
    registerMapView(this, config, prefs)
    registerHeader(this, config)
    registerSettings(this, config, prefs)
  }
}
