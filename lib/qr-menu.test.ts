import { describe, expect, it } from "vitest"
import {
  almatyToLunchDay,
  getAlmatyDayOfWeek,
  matchQrMenuDayFromFileName,
  qrMenuFileBaseName,
  resolveQrMenuDay,
  withCacheBust,
} from "@/lib/qr-menu"

describe("almatyToLunchDay", () => {
  it("maps Mon–Fri", () => {
    expect(almatyToLunchDay(1)).toBe(1)
    expect(almatyToLunchDay(5)).toBe(5)
    expect(almatyToLunchDay(0)).toBeNull()
    expect(almatyToLunchDay(6)).toBeNull()
  })
})

describe("getAlmatyDayOfWeek", () => {
  it("returns weekday for known UTC instants (Almaty = UTC+5)", () => {
    // 2026-09-21 05:00 UTC = Mon 10:00 Almaty
    expect(getAlmatyDayOfWeek(new Date("2026-09-21T05:00:00.000Z"))).toBe(1)
    // 2026-09-19 12:00 UTC = Sat 17:00 Almaty
    expect(getAlmatyDayOfWeek(new Date("2026-09-19T12:00:00.000Z"))).toBe(6)
    // 2026-09-20 12:00 UTC = Sun 17:00 Almaty
    expect(getAlmatyDayOfWeek(new Date("2026-09-20T12:00:00.000Z"))).toBe(0)
  })
})

describe("qr file names", () => {
  it("builds basename", () => {
    expect(qrMenuFileBaseName(3)).toBe("menu-azure-3")
  })
  it("matches dropbox names", () => {
    expect(matchQrMenuDayFromFileName("menu-azure-2.png")).toBe(2)
    expect(matchQrMenuDayFromFileName("banner-azure.jpg")).toBeNull()
    expect(matchQrMenuDayFromFileName("menu-azure-5.JPEG")).toBe(5)
  })
})

describe("parseOrderDayParam", () => {
  it("accepts number, short and full keys", async () => {
    const { parseOrderDayParam } = await import("@/lib/qr-menu")
    expect(parseOrderDayParam("3")).toBe("wednesday")
    expect(parseOrderDayParam("thu")).toBe("thursday")
    expect(parseOrderDayParam("friday")).toBe("friday")
    expect(parseOrderDayParam("nope")).toBeNull()
  })
})

describe("withCacheBust", () => {
  it("appends v=", () => {
    expect(withCacheBust("https://x/file/1", "abc")).toBe("https://x/file/1?v=abc")
    expect(withCacheBust("https://x/file/1?a=1", "2")).toBe("https://x/file/1?a=1&v=2")
  })
})

describe("resolveQrMenuDay", () => {
  it("with forceMonday returns Monday even on Sunday", () => {
    const r = resolveQrMenuDay(new Date("2026-09-20T12:00:00"), { forceMonday: true })
    expect(r.isWeekend).toBe(false)
    expect(r.autoDay).toBe(1)
    expect(r.initialTab).toBe(1)
  })

  it("weekday without force: Wednesday → day 3", () => {
    // Wed 2026-09-23 10:00 Almaty = 05:00 UTC
    const r = resolveQrMenuDay(new Date("2026-09-23T05:00:00.000Z"), { forceMonday: false })
    expect(r.isWeekend).toBe(false)
    expect(r.autoDay).toBe(3)
    expect(r.initialTab).toBe(3)
  })

  it("Saturday without force: weekend notice, tab Mon for browse", () => {
    const r = resolveQrMenuDay(new Date("2026-09-19T12:00:00.000Z"), { forceMonday: false })
    expect(r.isWeekend).toBe(true)
    expect(r.autoDay).toBeNull()
    expect(r.initialTab).toBe(1)
  })

  it("Sunday without force: weekend, not Friday", () => {
    const r = resolveQrMenuDay(new Date("2026-09-20T12:00:00.000Z"), { forceMonday: false })
    expect(r.isWeekend).toBe(true)
    expect(r.autoDay).toBeNull()
    expect(r.initialTab).toBe(1)
  })
})
