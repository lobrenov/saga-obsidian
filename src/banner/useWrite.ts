import { useState } from 'react'
import { setField } from '../obsidian/vault'
import { useHeader } from '../header/env'
import { BANNER_Y_KEY } from '../shared/renderers/banner'

/** Writes a note key through the adapter, keeping the message of a failed write for an alert; resolves true on success. */
export function useWrite(): { write: (key: string, value: unknown) => Promise<boolean>; error: string | null } {
  const { env, file } = useHeader()
  const [error, setError] = useState<string | null>(null)
  const write = async (key: string, value: unknown): Promise<boolean> => {
    const result = await setField(env.app, file, key, value)
    setError(result.ok ? null : `Could not update “${key}”: ${result.error.message}`)
    return result.ok
  }
  return { write, error }
}

/** Removes the banner key, then `banner-y`. */
export async function removeBanner(write: ReturnType<typeof useWrite>['write'], key: string): Promise<void> {
  if (await write(key, undefined)) await write(BANNER_Y_KEY, undefined)
}
