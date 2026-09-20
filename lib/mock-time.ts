/**
 * Utility for mocking `Date` during testing.
 *
 * Usage: append `?mockTime=2026-04-06T13:00:00` to the URL.
 * Or set DEV_FORCE_MONDAY_MORNING in lib/constants.ts (temp local testing).
 *
 * Both server and client code should call `getMockDate()` instead of `new Date()`
 * so the mocked time is respected everywhere.
 */

import { DEV_FORCE_MONDAY_ISO, DEV_FORCE_MONDAY_MORNING } from "@/lib/constants"

function getMockTimeFromQuery(): Date | null {
  // Works in browser
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search)
    const mock = params.get("mockTime")
    if (mock) {
      const d = new Date(mock)
      if (!isNaN(d.getTime())) return d
    }
  }
  return null
}

/**
 * Return mocked Date (query → DEV Monday flag → real now).
 */
export function getMockDate(): Date {
  const fromQuery = getMockTimeFromQuery()
  if (fromQuery) return fromQuery
  if (DEV_FORCE_MONDAY_MORNING) {
    const d = new Date(DEV_FORCE_MONDAY_ISO)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Returns a human-readable label for UI hints (optional).
 * `undefined` means real time is in use.
 */
export function getMockTimeLabel(): string | undefined {
  const fromQuery = getMockTimeFromQuery()
  if (fromQuery) return fromQuery.toISOString()
  if (DEV_FORCE_MONDAY_MORNING) return `DEV_FORCE_MONDAY ${DEV_FORCE_MONDAY_ISO}`
  return undefined
}
