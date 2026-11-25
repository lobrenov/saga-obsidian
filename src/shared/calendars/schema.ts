import { z } from 'zod'
import type { Validated } from '../result'
import { zodIssues } from '../schemas/issues'

const name = z.string().trim().min(1, 'Must not be empty')

export const monthSchema = z.object({
  name,
  days: z.number().int().min(1, 'A month needs at least 1 day')
})
export type Month = z.output<typeof monthSchema>

export const eraSchema = z.object({
  name,
  short: name,
  side: z.enum(['before', 'after']),
  start: z.number().int().optional()
})
export type Era = z.output<typeof eraSchema>

/** The calendar note's keys. */
export const calendarSchema = z
  .object({
    months: z.array(monthSchema).min(1, 'A calendar needs at least 1 month'),
    weekdays: z.array(name).min(1, 'A calendar needs at least 1 weekday'),
    'first-weekday': name,
    eras: z.array(eraSchema).default([])
  })
  .superRefine((calendar, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })
    if (!calendar.weekdays.includes(calendar['first-weekday'])) issue(['first-weekday'], 'Not one of the weekdays')
    calendar.weekdays.forEach((weekday, index) => {
      if (calendar.weekdays.indexOf(weekday) !== index) issue(['weekdays', index], 'Weekday names must be unique')
    })
    // `start` counts years away from year 1; before eras run earliest first, so their starts fall and after eras' rise.
    const last = { before: Infinity, after: 1 }
    const seen = { before: false, after: false }
    calendar.eras.forEach((era, index) => {
      const at = (key: string) => ['eras', index, key]
      if (calendar.eras.findIndex((e) => e.name === era.name) !== index) issue(at('name'), 'Era names must be unique')
      if (era.side === 'before' && seen.after) issue(at('side'), 'Before eras come first')
      if (!seen[era.side]) {
        seen[era.side] = true
        if (era.start !== undefined) issue(at('start'), `The first ${era.side} era has no start`)
        return
      }
      if (era.start === undefined) return issue(at('start'), 'Needs a start')
      if (era.start < 1) return issue(at('start'), 'Starts count from 1')
      const ordered = era.side === 'before' ? era.start < last.before : era.start > last.after
      if (!ordered) issue(at('start'), 'Starts must increase in time')
      last[era.side] = era.start
    })
  })
export type Calendar = z.output<typeof calendarSchema>

/** Validates a calendar note's frontmatter. */
export function parseCalendar(raw: Readonly<Record<string, unknown>>): Validated<Calendar> {
  const parsed = calendarSchema.safeParse(raw)
  return parsed.success ? { value: parsed.data, issues: [] } : { value: undefined, issues: zodIssues(parsed.error) }
}

/** A note's date keys without their prefix. */
export const dateKeysSchema = z
  .object({
    era: name.optional(),
    year: z
      .number()
      .int()
      .refine((year) => year !== 0, { message: 'There is no year 0' })
      .optional(),
    month: z.number().int().min(1, 'Months count from 1').optional(),
    day: z.number().int().min(1, 'Days count from 1').optional()
  })
  .superRefine((keys, ctx) => {
    const need = (key: 'month' | 'day', coarser: 'year' | 'month') => {
      if (keys[key] !== undefined && keys[coarser] === undefined)
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key === 'month' ? 'Month' : 'Day'} needs a ${coarser}`
        })
    }
    need('month', 'year')
    need('day', 'month')
    if (keys.era !== undefined && (keys.year !== undefined || keys.month !== undefined || keys.day !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['era'],
        message: 'Era is for a date with no year'
      })
    }
  })
