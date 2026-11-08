import { z } from 'zod'

/** Vault-relative, forward slashes, no leading slash, no empty, `.` or `..` segments. */
function isNotePath(path: string): boolean {
  if (path.includes('\\') || path.includes('\0')) return false
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export const notePathSchema = z
  .string()
  .refine(isNotePath, { message: 'Must be a vault-relative path with forward slashes and no `..` segments' })
  .brand<'NotePath'>()
export type NotePath = z.output<typeof notePathSchema>

/** A note file Saga may write: a NotePath ending in `.md` with no dot-prefixed segment (keeps `.saga`, `.obsidian` and temp files out of reach). */
export const noteFilePathSchema = notePathSchema
  .refine((path) => path.toLowerCase().endsWith('.md') && path.split('/').every((segment) => !segment.startsWith('.')), {
    message: 'Must be a `.md` file outside dot-folders'
  })
  .brand<'NoteFilePath'>()
export type NoteFilePath = z.output<typeof noteFilePathSchema>

export const noteIdSchema = z.string().min(1).brand<'NoteId'>()
export type NoteId = z.output<typeof noteIdSchema>

/** Brands a trusted string as a NotePath; throws if it is not a valid vault-relative path. */
export const noteFilePath = (path: string): NoteFilePath => noteFilePathSchema.parse(path)

export const notePath = (path: string): NotePath => notePathSchema.parse(path)
