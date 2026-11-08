/** A problem found while validating data; `path` is dot-joined and empty for the root. */
export interface Issue {
  path: string
  message: string
}

export type SagaError =
  | { kind: 'conflict'; message: string; currentHash: string }
  | { kind: 'not-found'; message: string }
  | { kind: 'not-implemented'; message: string }
  | { kind: 'parse'; message: string }
  | { kind: 'io'; message: string; notDownloaded?: true; offline?: true; permission?: true }
  | { kind: 'validation'; message: string; issues: Issue[] }

export type Ok<T> = { ok: true; value: T }
export type Err<E> = { ok: false; error: E }
export type Result<T, E = SagaError> = Ok<T> | Err<E>

const PERMISSION_CODES = new Set(['EPERM', 'EACCES'])
const errorCode = (error: unknown): string | undefined => {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' ? code : undefined
}

/** True for the errors macOS raises when a folder is protected (TCC) or a file's mode denies access. */
export const isPermissionError = (error: unknown): boolean => PERMISSION_CODES.has(errorCode(error) ?? '')

export const PERMISSION_GUIDANCE =
  'Saga is not allowed to read this location. Allow it in System Settings → Privacy & Security → Files and Folders (or Full Disk Access), then open the vault again.'

export const ioError = (error: unknown): SagaError => {
  if (isPermissionError(error)) return { kind: 'io', message: `${PERMISSION_GUIDANCE} (${errorCode(error)})`, permission: true }
  return { kind: 'io', message: error instanceof Error ? error.message : String(error) }
}

export const offlineError = (): SagaError => ({ kind: 'io', message: 'The vault is offline; nothing was written', offline: true })

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })

/** A value read leniently: `value` is undefined when it was missing or invalid, with the reasons in `issues`. */
export interface Validated<T> {
  value: T | undefined
  issues: Issue[]
}
