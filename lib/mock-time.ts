/**
 * Optional Date override for local/devtools testing via URL:
 * `?mockTime=2026-04-06T13:00:00`
 *
 * Production uses real time unless that query param is present.
 */

function getMockTimeFromQuery(): Date | null {
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

/** Real now, or URL mockTime when set. */
export function getMockDate(): Date {
  return getMockTimeFromQuery() ?? new Date()
}

/** UI hint when mockTime is active; undefined = real clock. */
export function getMockTimeLabel(): string | undefined {
  const fromQuery = getMockTimeFromQuery()
  return fromQuery ? fromQuery.toISOString() : undefined
}
