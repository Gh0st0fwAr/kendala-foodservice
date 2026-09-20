import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import { parseMenuExcelRows } from "@/lib/menu-excel"
import { processOrderDaysForNotify } from "@/lib/order-notify"
import type { DayMenu } from "@/lib/order-types"
import type { Order } from "@/lib/api"

const rowsPath = path.resolve(__dirname, "../docs/client/menu-mock-rows.json")

describe("client mock Excel rows", () => {
  it("parses 5 days × (8 lunch + dessert) without errors", () => {
    const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as unknown[]
    const parsed = parseMenuExcelRows(rows)
    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])
    expect(parsed.dishes).toHaveLength(45)
    for (let day = 1; day <= 5; day++) {
      const dayDishes = parsed.dishes.filter((d) => d.day === day)
      expect(dayDishes).toHaveLength(9)
      expect(dayDishes.filter((d) => (d.type || "").toLowerCase() === "dessert")).toHaveLength(1)
      expect(dayDishes.filter((d) => (d.type || "").toLowerCase() === "drink")).toHaveLength(2)
    }
  })

  it("dry-run notify includes dessert name and 690×qty in total", () => {
    const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as Array<{
      day: number
      name: string
      type?: string
    }>
    const monday = rows.filter((r) => r.day === 1)
    const menu: DayMenu[] = [
      {
        day: "monday",
        date: "2026-09-21",
        dishes: monday.map((r, i) => ({
          id: String(i + 1),
          name: r.name,
          type: r.type,
        })),
      },
    ]

    const order = {
      customer: { fullName: "Тест", phone: "+77000000000", address: "тест" },
      orderDays: [
        {
          day: "monday",
          date: "2026-09-21",
          selectedDishes: ["1", "3", "5", "7"],
          deliveryTime: "12:00-13:00",
          quantity: 2,
          dessertQuantity: 3,
        },
      ],
    } as Order

    const days = processOrderDaysForNotify(order, menu)
    expect(days).toHaveLength(1)
    expect(days[0].dessertName).toBe("Тирамису")
    expect(days[0].selectedDishes.some((n) => n.includes("Тирамису ×3"))).toBe(true)
    // 3690*2 + 690*3 = 9450
    expect(days[0].price).toBe("9450 тг")
  })
})
