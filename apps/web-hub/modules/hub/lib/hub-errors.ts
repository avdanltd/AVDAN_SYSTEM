import { ApiClientError } from '@/lib/api-client'

export const HUB_NOT_ASSIGNED_MESSAGE =
  "Your account isn't assigned to a hub yet. Ask your AVDAN administrator to assign you to one."

/** The API refuses hub endpoints for an agent with no hub (422 HUB_NOT_ASSIGNED). That is a setup
 *  gap to fix, not a connection problem, so the pages say so instead of "couldn't load". */
export function isHubNotAssigned(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === 'HUB_NOT_ASSIGNED'
}
