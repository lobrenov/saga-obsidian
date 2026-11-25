import { useEffect, useState, type RefObject } from 'react'
import type { TFile } from 'obsidian'
import { toExcerpt } from '../shared/markdown/excerpt'
import type { CalendarHost } from './host'

const NEAR = '300px'

/** The note's excerpt of `chars` characters, read again when the note changes. With a `target`, it is read once that element nears the viewport. */
export function useExcerpt(host: CalendarHost, file: TFile, chars: number, target?: RefObject<Element | null>): string {
  const [text, setText] = useState('')
  const [near, setNear] = useState(target === undefined)
  const modified = file.stat.mtime

  useEffect(() => {
    const el = target?.current
    if (near || !el) return
    const observer = new IntersectionObserver(
      (observed) => {
        if (observed.some((entry) => entry.isIntersecting)) setNear(true)
      },
      { rootMargin: NEAR }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, target])

  useEffect(() => {
    if (!near) return
    let live = true
    void host.excerpt(file).then((raw) => live && setText(toExcerpt(raw, chars)))
    return () => {
      live = false
    }
  }, [host, file, chars, modified, near])
  return text
}
