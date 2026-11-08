import { z } from 'zod'
import type { Issue } from '../result'

export const issueSchema = z.object({ path: z.string(), message: z.string() })

export function zodIssues(error: z.ZodError, prefix = ''): Issue[] {
  return error.issues.map((issue) => ({
    path: [prefix, ...issue.path.map(String)].filter(Boolean).join('.'),
    message: issue.message
  }))
}
