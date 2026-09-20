import { describe, expect, it } from "vitest"
import {
  EXPECTED_DAY_TYPES,
  markPositionalDessert,
  normalizeDishType,
  parseMenuExcelRows,
} from "@/lib/menu-excel"

function typedDay(day = 1, withDessert = true) {
  const lunch = EXPECTED_DAY_TYPES.slice(0, 8).map((type, i) => ({
    day,
    name: `L${i}`,
    type,
  }))
  if (!withDessert) return lunch
  return [...lunch, { day, name: "Панакота", type: "dessert" as const }]
}

describe("normalizeDishType", () => {
  it("maps aliases", () => {
    expect(normalizeDishType("Десерт")).toBe("dessert")
    expect(normalizeDishType("горячее")).toBe("main")
    expect(normalizeDishType("напиток")).toBe("drink")
    expect(normalizeDishType("nope")).toBe(null)
  })
})

describe("parseMenuExcelRows", () => {
  it("rejects empty", () => {
    const r = parseMenuExcelRows([])
    expect(r.ok).toBe(false)
  })

  it("accepts classic untyped 8 rows/day and warns about missing dessert", () => {
    const rows = []
    for (let i = 0; i < 8; i++) {
      rows.push({ day: 1, name: `Dish ${i}`, description: "", calories: 100 })
    }
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes("десерт не указан"))).toBe(true)
  })

  it("rejects untyped 9th row (no silent positional dessert on upload)", () => {
    const rows = []
    for (let i = 0; i < 8; i++) {
      rows.push({ day: 1, name: `L${i}`, calories: 10 })
    }
    rows.push({ day: 1, name: "Наполеон", calories: 300 })
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("type=dessert"))).toBe(true)
  })

  it("accepts full typed contract", () => {
    const r = parseMenuExcelRows(typedDay(1, true))
    expect(r.ok).toBe(true)
    expect(r.errors).toEqual([])
    expect(r.dishes[8].type).toBe("dessert")
  })

  it("rejects wrong order even if dessert type exists", () => {
    const rows = [
      { day: 1, name: "s1", type: "salad" },
      { day: 1, name: "s2", type: "salad" },
      { day: 1, name: "soup1", type: "soup" },
      { day: 1, name: "soup2", type: "soup" },
      { day: 1, name: "m1", type: "main" },
      { day: 1, name: "m2", type: "main" },
      { day: 1, name: "d1", type: "drink" },
      { day: 1, name: "tiramisu", type: "dessert" },
      { day: 1, name: "d2", type: "drink" },
    ]
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(false)
    expect(r.errors.some((e) => e.includes("позиция"))).toBe(true)
  })

  it("rejects unknown type", () => {
    const rows = [{ day: 1, name: "x", type: "snack" }]
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/неизвестный type/)
  })

  it("keeps description as opaque text (price not parsed)", () => {
    const rows = [
      ...typedDay(1, false),
      {
        day: 1,
        name: "Тирамису",
        type: "dessert",
        description: "Десерт дня · 999 ₸ · игнорировать",
      },
    ]
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(true)
    expect(r.dishes[8].description).toContain("999")
    // Parser must not invent a price field
    expect(Object.keys(r.dishes[8]).sort()).toEqual(
      ["calories", "day", "description", "name", "type"].sort(),
    )
  })
})

describe("markPositionalDessert", () => {
  it("marks index 8 for legacy runtime menus", () => {
    const dishes = Array.from({ length: 9 }, (_, i) => ({
      id: String(i + 1),
      name: `n${i}`,
    }))
    const marked = markPositionalDessert(dishes)
    expect(marked[8].type).toBe("dessert")
    expect(marked[0].type).toBeUndefined()
  })
})
