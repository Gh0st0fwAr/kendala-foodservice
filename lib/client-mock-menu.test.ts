import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import * as XLSX from "xlsx"
import { EXPECTED_DAY_TYPES, parseMenuExcelRows } from "@/lib/menu-excel"
import { processOrderDaysForNotify } from "@/lib/order-notify"
import {
  calculateDayLineTotal,
  getDessertDish,
  getLunchDishGroups,
} from "@/lib/dessert"
import { DESSERTS_PRICE, DELIVERY_FEE, PRICE_DISHES } from "@/lib/constants"
import type { DayMenu } from "@/lib/order-types"
import type { Order } from "@/lib/api"

const rowsPath = path.resolve(__dirname, "../docs/client/menu-mock-rows.json")
const xlsxPath = path.resolve(
  __dirname,
  "../docs/client/AZURE-menu-week-s-desertom-MOCK.xlsx",
)

describe("client mock Excel rows / xlsx acceptance", () => {
  it("JSON mock: 5 days × typed 8+dessert in contract order", () => {
    const rows = JSON.parse(readFileSync(rowsPath, "utf8")) as unknown[]
    const parsed = parseMenuExcelRows(rows)
    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])
    expect(parsed.dishes).toHaveLength(45)
    for (let day = 1; day <= 5; day++) {
      const dayDishes = parsed.dishes.filter((d) => d.day === day)
      expect(dayDishes).toHaveLength(9)
      expect(dayDishes.map((d) => d.type)).toEqual([...EXPECTED_DAY_TYPES])
    }
  })

  it("real .xlsx mock: sheet → parse → DayMenu → dessert → notify totals", () => {
    const buf = readFileSync(xlsxPath)
    const workbook = XLSX.read(buf, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const json = XLSX.utils.sheet_to_json(sheet)
    const parsed = parseMenuExcelRows(json as unknown[])
    expect(parsed.ok).toBe(true)
    expect(parsed.errors).toEqual([])

    const mondayRows = parsed.dishes.filter((d) => d.day === 1)
    const menu: DayMenu = {
      day: "monday",
      date: "2026-09-21",
      dishes: mondayRows.map((r, i) => ({
        id: String(i + 1),
        name: r.name,
        description: r.description,
        type: r.type,
      })),
    }

    const groups = getLunchDishGroups(menu)
    expect(groups.salads).toHaveLength(2)
    expect(groups.drinks).toHaveLength(2)
    // dessert must not leak into lunch slots
    expect(groups.drinks.every((d) => d.type === "drink")).toBe(true)

    const dessert = getDessertDish(menu)
    expect(dessert?.name).toBe("Тирамису")
    expect(dessert?.type).toBe("dessert")
    // UI price source is constant, not description text
    expect(DESSERTS_PRICE).toBe(690)
    expect(dessert?.description || "").toMatch(/690/)

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

    const line = calculateDayLineTotal(order.orderDays[0])
    expect(line).toBe(2 * PRICE_DISHES + 2 * DELIVERY_FEE + 3 * DESSERTS_PRICE)

    const days = processOrderDaysForNotify(order, [menu])
    expect(days[0].dessertName).toBe("Тирамису")
    expect(days[0].selectedDishes.some((n) => n.includes("Тирамису ×3"))).toBe(true)
    // notify lunch line historically without delivery fee in price string
    expect(days[0].price).toBe("9450 тг")
  })
})
