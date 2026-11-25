import { frontmatterOf, resolveLink, resourceUrl } from '../obsidian/vault'
import { formatDate, type CalendarDate } from '../shared/calendars/dates'
import { rendererDefs } from '../shared/renderers/definitions'
import { createRendererResolver } from '../shared/renderers/resolve'
import type { WikiLink } from '../shared/wikilink'
import { useHeader } from '../header/env'
import type { FieldViewProps } from '../header/FieldView'
import { Icon } from '../header/Icon'
import { NO_CALENDAR, noteCalendar } from '../header/noteCalendar'

/** A link as a read-only chip: the linked note's renderer icon and `alias ?? basename ?? target`. */
function PrintChip({ link }: { link: WikiLink }) {
  const { env, file, config } = useHeader()
  const resolved = resolveLink(env.app, link, file.path)
  const renderer = resolved ? createRendererResolver(config)(frontmatterOf(env.app, resolved)).renderer : null
  return (
    <span className={`saga-header-chip${resolved ? '' : ' is-unresolved'}`} data-renderer={renderer ?? undefined}>
      <Icon name={renderer ? rendererDefs[renderer].icon : 'unlink'} />
      {link.alias ?? resolved?.basename ?? link.target}
    </span>
  )
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)

/** The field's value as static content; null when there is nothing to show. */
function PrintValue({ def, value, frontmatter }: Pick<FieldViewProps, 'def' | 'frontmatter'> & { value: unknown }) {
  const { env, file, config, renderer } = useHeader()
  switch (def.kind) {
    case 'text':
    case 'choice':
      return <>{value as string}</>
    case 'list':
      return (
        <div className="saga-header-chips">
          {(value as string[]).map((item, i) => (
            <span key={i} className="saga-header-chip">
              {item}
            </span>
          ))}
        </div>
      )
    case 'link':
      return <PrintChip link={value as WikiLink} />
    case 'links':
      return (
        <div className="saga-header-chips">
          {(value as WikiLink[]).map((link, i) => (
            <PrintChip key={i} link={link} />
          ))}
        </div>
      )
    case 'date':
      return <>{formatDate(noteCalendar(env.app, file, config, renderer, frontmatter).calendar ?? NO_CALENDAR, value as CalendarDate)}</>
    case 'image': {
      const resolved = resolveLink(env.app, value as WikiLink, file.path)
      if (!resolved) return null
      return (
        <div className="saga-header-image">
          <div className="saga-header-frame">
            <img src={resourceUrl(env.app, resolved)} alt={def.label} />
          </div>
        </div>
      )
    }
  }
}

/** One field, read-only: label and value. Nothing for an empty value, one failing its schema, or an image that does not resolve. */
export function PrintField({ def, noteKey, raw, layer, frontmatter, className }: FieldViewProps) {
  const { env, file } = useHeader()
  if (isEmpty(raw) || layer.issues.length > 0 || isEmpty(layer.value)) return null
  if (def.kind === 'image' && !resolveLink(env.app, layer.value as WikiLink, file.path)) return null
  return (
    <div className={`saga-header-field ${className ?? ''}`} data-field={noteKey} data-kind={def.kind}>
      <span className="saga-header-label">{def.label}</span>
      <div className="saga-header-control">
        <PrintValue def={def} value={layer.value} frontmatter={frontmatter} />
      </div>
    </div>
  )
}
