import { Children, type ReactNode } from 'react'
import type { character, document, faction, item, location, lore, map } from '../shared/renderers/definitions'
import { LoreFooter } from './LoreFooter'
import type { LayoutProps } from './types'

/** The note's title and facts to the right of the field beside them. */
function Identity({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="saga-header-identity">
      {title}
      {children}
    </div>
  )
}

/** The facts grid; nothing when every field in it is left out. */
function Facts({ children }: { children: ReactNode }) {
  const fields = Children.toArray(children)
  return fields.length > 0 ? <div className="saga-header-facts">{fields}</div> : null
}

/** Portrait card beside the name, epithet and facts (affiliation, location, status). */
export function CharacterLayout({ title, field }: LayoutProps<typeof character>) {
  return (
    <div className="saga-header-split">
      {field('portrait', 'saga-header-portrait')}
      <Identity title={title}>
        {field('title', 'saga-header-epithet')}
        <Facts>
          {field('affiliation')}
          {field('location')}
          {field('status')}
        </Facts>
      </Identity>
    </div>
  )
}

/** Name, kind and region. */
export function LocationLayout({ title, field }: LayoutProps<typeof location>) {
  return (
    <>
      <Identity title={title}>
        <Facts>
          {field('kind')}
          {field('region')}
        </Facts>
      </Identity>
    </>
  )
}

/** Emblem beside the name, kind, leader, base, allies and rivals. */
export function FactionLayout({ title, field }: LayoutProps<typeof faction>) {
  return (
    <div className="saga-header-split">
      {field('emblem', 'saga-header-emblem')}
      <Identity title={title}>
        <Facts>
          {field('kind')}
          {field('leader')}
          {field('base')}
          {field('allies')}
          {field('rivals')}
        </Facts>
      </Identity>
    </div>
  )
}

/** Image beside the name, kind, rarity, owner and location. */
export function ItemLayout({ title, field }: LayoutProps<typeof item>) {
  return (
    <div className="saga-header-split">
      {field('image', 'saga-header-emblem')}
      <Identity title={title}>
        <Facts>
          {field('kind')}
          {field('rarity')}
          {field('owner')}
          {field('location')}
        </Facts>
      </Identity>
    </div>
  )
}

/** The map's name. */
export function MapLayout({ title }: LayoutProps<typeof map>) {
  return <Identity title={title}>{null}</Identity>
}

/** The name, then when, ends, calendar, where and who. */
export function LorePrintLayout({ title, field }: LayoutProps<typeof lore>) {
  return (
    <Identity title={title}>
      <Facts>
        {field('when')}
        {field('end')}
        {field('calendar')}
        {field('where')}
        {field('who')}
      </Facts>
    </Identity>
  )
}

/** The Lore facts, then the notes before and after on the same calendar. */
export function LoreLayout(props: LayoutProps<typeof lore>) {
  return (
    <>
      <LorePrintLayout {...props} />
      <LoreFooter />
    </>
  )
}

/** The title alone. */
export function DocumentLayout({ title }: Pick<LayoutProps<typeof document>, 'title'>) {
  return <Identity title={title}>{null}</Identity>
}
