import { DEV_FORCE_MONDAY_MORNING } from "@/lib/constants"
import { getMockDate } from "@/lib/mock-time"

/** Dropbox basename prefixes: menu-azure-1 … menu-azure-5 (Mon–Fri) */
export const QR_MENU_FILE_PREFIX = "menu-azure"

export const QR_MENU_DAYS = [
  { day: 1 as const, key: "mon", label: "ПН", orderDay: "monday" },
  { day: 2 as const, key: "tue", label: "ВТ", orderDay: "tuesday" },
  { day: 3 as const, key: "wed", label: "СР", orderDay: "wednesday" },
  { day: 4 as const, key: "thu", label: "ЧТ", orderDay: "thursday" },
  { day: 5 as const, key: "fri", label: "ПТ", orderDay: "friday" },
]

export type QrMenuDayNum = 1 | 2 | 3 | 4 | 5

export type QrMenuResolve = {
  isWeekend: boolean
  /** Auto day Mon–Fri; null on Sat/Sun */
  autoDay: QrMenuDayNum | null
  /** Suggested initial tab: auto day or Monday on weekend for manual browse */
  initialTab: QrMenuDayNum
}

/**
 * Weekday in Asia/Almaty: 0=Sun … 6=Sat (JS style).
 */
export function getAlmatyDayOfWeek(date: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Almaty",
    weekday: "short",
  }).format(date)
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return map[wd] ?? date.getDay()
}

/** Mon=1 … Fri=5; null on weekend */
export function almatyToLunchDay(jsWeekday: number): QrMenuDayNum | null {
  if (jsWeekday >= 1 && jsWeekday <= 5) return jsWeekday as QrMenuDayNum
  return null
}

export type ResolveQrMenuDayOpts = {
  /**
   * Override DEV_FORCE_MONDAY_MORNING (tests / explicit callers).
   * Default: value from constants.
   */
  forceMonday?: boolean
}

/**
 * Resolve which day the QR page should open on.
 * Uses getMockDate() so DEV_FORCE_MONDAY_MORNING / ?mockTime apply.
 * Weekend: do NOT pretend it's Friday — autoDay=null, initialTab=1 for browsing.
 */
export function resolveQrMenuDay(
  now: Date = getMockDate(),
  opts: ResolveQrMenuDayOpts = {},
): QrMenuResolve {
  const forceMonday = opts.forceMonday ?? DEV_FORCE_MONDAY_MORNING
  if (forceMonday) {
    return { isWeekend: false, autoDay: 1, initialTab: 1 }
  }
  const jsDay = getAlmatyDayOfWeek(now)
  const autoDay = almatyToLunchDay(jsDay)
  if (autoDay == null) {
    return { isWeekend: true, autoDay: null, initialTab: 1 }
  }
  return { isWeekend: false, autoDay, initialTab: autoDay }
}

export function qrMenuFileBaseName(day: QrMenuDayNum): string {
  return `${QR_MENU_FILE_PREFIX}-${day}`
}

/** Match dropbox file name (with or without extension) to day 1–5 */
export function matchQrMenuDayFromFileName(fileName: string): QrMenuDayNum | null {
  const base = fileName.split("/").pop()?.split(".")[0]?.toLowerCase() || ""
  for (const d of QR_MENU_DAYS) {
    if (base === qrMenuFileBaseName(d.day).toLowerCase()) return d.day
  }
  return null
}

/**
 * Cache-bust: prefer dlId (changes on replace). Fallback timestamp.
 */
export function withCacheBust(url: string, version: string | number): string {
  if (!url) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}v=${encodeURIComponent(String(version))}`
}

export function dropboxFilePublicUrl(dlId: string): string {
  return `https://ibronevik.ru/taxi/api/v1/dropbox/file/${dlId}`
}

/** Prefer raster over leftover svg when several menu-azure-N exist */
export function preferRasterDropboxEntries<
  T extends { dl_id?: string; json?: { name?: string; name_upload?: string } },
>(entries: T[]): T | null {
  if (!entries.length) return null
  const score = (e: T) => {
    const name = e.json?.name || e.json?.name_upload || ""
    const ext = name.split(".").pop()?.toLowerCase() || ""
    const raster = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? 1000 : 0
    return raster + (Number(e.dl_id) || 0)
  }
  return [...entries].sort((a, b) => score(b) - score(a))[0] || null
}

/** Parse `?day=` from QR CTA: 1–5, mon/tue, monday/tuesday */
export function parseOrderDayParam(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  const byNum = QR_MENU_DAYS.find((d) => String(d.day) === v)
  if (byNum) return byNum.orderDay
  const byKey = QR_MENU_DAYS.find((d) => d.key === v || d.orderDay === v)
  if (byKey) return byKey.orderDay
  return null
}
