import type { ReactNode } from 'react'
import type { character, document, faction, item, location, map } from '../shared/renderers/definitions'
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

/** Portrait card beside the name, epithet and facts (affiliation, location, status). */
export function CharacterLayout({ title, field }: LayoutProps<typeof character>) {
  return (
    <div className="saga-header-split">
      {field('portrait', 'saga-header-portrait')}
      <Identity title={title}>
        {field('title', 'saga-header-epithet')}
        <div className="saga-header-facts">
          {field('affiliation')}
          {field('location')}
          {field('status')}
        </div>
      </Identity>
    </div>
  )
}

/** Name, kind and region. */
export function LocationLayout({ title, field }: LayoutProps<typeof location>) {
  return (
    <>
      <Identity title={title}>
        <div className="saga-header-facts">
          {field('kind')}
          {field('region')}
        </div>
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
        <div className="saga-header-facts">
          {field('kind')}
          {field('leader')}
          {field('base')}
          {field('allies')}
          {field('rivals')}
        </div>
      </Identity>
    </div>
  )
}

/** Name, kind, rarity, holder, owner, location and origin. */
export function ItemLayout({ title, field }: LayoutProps<typeof item>) {
  return (
    <>
      <Identity title={title}>
        <div className="saga-header-facts">
          {field('kind')}
          {field('rarity')}
          {field('holder')}
          {field('owner')}
          {field('location')}
          {field('origin')}
        </div>
      </Identity>
    </>
  )
}

/** The map's name. */
export function MapLayout({ title }: LayoutProps<typeof map>) {
  return <Identity title={title}>{null}</Identity>
}

/** The title alone. */
export function DocumentLayout({ title }: LayoutProps<typeof document>) {
  return <Identity title={title}>{null}</Identity>
}
