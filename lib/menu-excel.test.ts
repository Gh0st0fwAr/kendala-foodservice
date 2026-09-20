import { describe, expect, it } from "vitest"
import { markPositionalDessert, parseMenuExcelRows } from "@/lib/menu-excel"

describe("parseMenuExcelRows", () => {
  it("rejects empty", () => {
    const r = parseMenuExcelRows([])
    expect(r.ok).toBe(false)
  })

  it("accepts classic 8 rows/day and warns about missing dessert", () => {
    const rows = []
    for (let day = 1; day <= 1; day++) {
      for (let i = 0; i < 8; i++) {
        rows.push({ day, name: `Dish ${i}`, description: "", calories: 100 })
      }
    }
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(true)
    expect(r.warnings.some((w) => w.includes("десерт не указан"))).toBe(true)
  })

  it("accepts 9th positional dessert", () => {
    const rows = []
    for (let i = 0; i < 8; i++) {
      rows.push({ day: 1, name: `L${i}`, calories: 10 })
    }
    rows.push({ day: 1, name: "Наполеон", calories: 300 })
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(true)
    expect(r.dishes).toHaveLength(9)
    expect(r.warnings.some((w) => w.includes("9-я позиция"))).toBe(true)
  })

  it("accepts typed dessert column", () => {
    const rows = [
      ...Array.from({ length: 8 }, (_, i) => ({ day: 1, name: `L${i}` })),
      { day: 1, name: "Панакота", type: "dessert" },
    ]
    const r = parseMenuExcelRows(rows)
    expect(r.ok).toBe(true)
    expect(r.dishes[8].type).toBe("dessert")
  })
})

describe("markPositionalDessert", () => {
  it("marks index 8", () => {
    const dishes = Array.from({ length: 9 }, (_, i) => ({
      id: String(i + 1),
      name: `n${i}`,
    }))
    const marked = markPositionalDessert(dishes)
    expect(marked[8].type).toBe("dessert")
    expect(marked[0].type).toBeUndefined()
  })
})
