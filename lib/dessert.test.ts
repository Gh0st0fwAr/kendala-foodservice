import { describe, expect, it } from "vitest"
import {
  calculateDayLineTotal,
  calculateDessertLineTotal,
  calculateOrderTotal,
  getDessertDish,
  getLunchDishGroups,
  isCompleteLunchSelection,
  normalizeDessertQuantity,
  sanitizeOrderDayDesserts,
} from "@/lib/dessert"
import { DESSERTS_PRICE, DELIVERY_FEE, PRICE_DISHES } from "@/lib/constants"
import type { DayMenu, OrderDay } from "@/lib/order-types"

describe("normalizeDessertQuantity", () => {
  it("floors and clamps negatives", () => {
    expect(normalizeDessertQuantity(2.9)).toBe(2)
    expect(normalizeDessertQuantity(-1)).toBe(0)
    expect(normalizeDessertQuantity("3")).toBe(3)
    expect(normalizeDessertQuantity("x")).toBe(0)
  })
})

describe("isCompleteLunchSelection", () => {
  it("requires exactly 4 selected ids", () => {
    expect(isCompleteLunchSelection(["1", "2", "3", "4"])).toBe(true)
    expect(isCompleteLunchSelection(["1", "2", "3"])).toBe(false)
  })
})

describe("getDessertDish / getLunchDishGroups", () => {
  const menu: DayMenu = {
    day: "monday",
    date: "2026-09-21",
    dishes: [
      { id: "1", name: "S1" },
      { id: "2", name: "S2" },
      { id: "3", name: "Soup1" },
      { id: "4", name: "Soup2" },
      { id: "5", name: "M1" },
      { id: "6", name: "M2" },
      { id: "7", name: "D1" },
      { id: "8", name: "D2" },
      { id: "9", name: "Тирамису" },
    ],
  }

  it("uses 9th positional slot as dessert", () => {
    expect(getDessertDish(menu)?.name).toBe("Тирамису")
  })

  it("prefers type=dessert over position", () => {
    const withType: DayMenu = {
      ...menu,
      dishes: [
        ...menu.dishes.slice(0, 8),
        { id: "9", name: "Positional" },
        { id: "10", name: "Чизкейк", type: "dessert" },
      ],
    }
    expect(getDessertDish(withType)?.name).toBe("Чизкейк")
  })

  it("splits lunch groups from first 8", () => {
    const g = getLunchDishGroups(menu)
    expect(g.salads).toHaveLength(2)
    expect(g.drinks[1].name).toBe("D2")
  })
})

describe("pricing", () => {
  it("dessert line", () => {
    expect(calculateDessertLineTotal(2)).toBe(2 * DESSERTS_PRICE)
    expect(DESSERTS_PRICE).toBe(690)
  })

  it("day total: lunch + delivery + dessert", () => {
    const total = calculateDayLineTotal({
      selectedDishes: ["a", "b", "c", "d"],
      quantity: 2,
      dessertQuantity: 3,
    })
    expect(total).toBe(2 * PRICE_DISHES + 2 * DELIVERY_FEE + 3 * DESSERTS_PRICE)
  })

  it("day total: no dessert charge without complete lunch", () => {
    const total = calculateDayLineTotal({
      selectedDishes: ["a", "b"],
      quantity: 1,
      dessertQuantity: 5,
    })
    expect(total).toBe(0)
  })

  it("order total across days", () => {
    const total = calculateOrderTotal([
      { selectedDishes: ["1", "2", "3", "4"], quantity: 1, dessertQuantity: 1 },
      { selectedDishes: ["1", "2", "3", "4"], quantity: 1, dessertQuantity: 0 },
    ])
    expect(total).toBe(2 * (PRICE_DISHES + DELIVERY_FEE) + DESSERTS_PRICE)
  })
})

describe("sanitizeOrderDayDesserts", () => {
  it("zeros dessert when lunch incomplete", () => {
    const day: OrderDay = {
      day: "monday",
      date: "2026-09-21",
      selectedDishes: ["1"],
      deliveryTime: "12:00",
      quantity: 1,
      dessertQuantity: 2,
    }
    expect(sanitizeOrderDayDesserts(day).dessertQuantity).toBe(0)
  })
})
