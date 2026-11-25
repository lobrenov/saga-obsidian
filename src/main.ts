import { Plugin } from 'obsidian'
import { registerCalendarView } from './calendar'
import { registerFileIcons } from './explorer'
import { registerHeader } from './header'
import { registerLinkIcons } from './links'
import { registerMapView } from './map'
import { createPrefsStore } from './obsidian/prefs'
import { createConfigStore } from './obsidian/vault'
import { registerPrint } from './print'
import { registerSettings } from './settings'
import './styles.css'

export default class SagaPlugin extends Plugin {
  override async onload(): Promise<void> {
    const config = await createConfigStore(this.app, this)
    const prefs = await createPrefsStore(this)
    registerMapView(this, config, prefs)
    registerCalendarView(this, config)
    registerHeader(this, config, prefs)
    registerLinkIcons(this, config, prefs)
    registerFileIcons(this, config, prefs)
    registerPrint(this, config, prefs)
    registerSettings(this, config, prefs)
  }
}
