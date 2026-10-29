// Registered at module scope so it's re-defined on every JS bundle (re)launch —
// including headless background relaunches, per Expo's background-location docs.
// Must be imported (for its side effect) from app/_layout.tsx unconditionally.
import * as TaskManager from 'expo-task-manager'
import type { LocationObject } from 'expo-location'

import { riderService } from '@/modules/rider/services/rider.service'

export const LOCATION_TASK_NAME = 'avdan-rider-location-broadcast'

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) return
  const { locations } = (data as { locations: LocationObject[] }) ?? { locations: [] }
  const latest = locations[locations.length - 1]
  if (!latest) return
  await riderService
    .broadcastLocation(latest.coords.latitude, latest.coords.longitude)
    .catch(() => {})
})
