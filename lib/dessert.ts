import { DELIVERY_FEE, DESSERTS_PRICE, PRICE_DISHES } from "@/lib/constants"
import {
  DESSERT_SLOT_INDEX,
  LUNCH_DISH_SLOTS,
  type DayMenu,
  type Dish,
  type OrderDay,
} from "@/lib/order-types"

/** Clamp dessert qty: integer >= 0. No dessert-only orders (qty can be >0 only with a valid lunch). */
export function normalizeDessertQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function isCompleteLunchSelection(selectedDishes: string[]): boolean {
  return selectedDishes.length === 4
}

/**
 * Dessert of the day from menu:
 * 1) dish with type/category dessert
 * 2) else 9th item (index 8) after lunch slots
 */
export function getDessertDish(dayMenu: DayMenu | undefined): Dish | null {
  if (!dayMenu?.dishes?.length) return null
  const byType = dayMenu.dishes.find((d) => {
    const t = (d.type || "").toLowerCase().trim()
    return t === "dessert" || t === "десерт"
  })
  if (byType) return byType
  if (dayMenu.dishes.length > DESSERT_SLOT_INDEX) {
    return dayMenu.dishes[DESSERT_SLOT_INDEX] || null
  }
  return null
}

export function getLunchDishGroups(dayMenu: DayMenu) {
  const lunch = dayMenu.dishes.slice(0, LUNCH_DISH_SLOTS)
  return {
    salads: lunch.slice(0, 2),
    soups: lunch.slice(2, 4),
    mains: lunch.slice(4, 6),
    drinks: lunch.slice(6, 8),
  }
}

export function calculateDessertLineTotal(dessertQuantity: number): number {
  const qty = normalizeDessertQuantity(dessertQuantity)
  return qty * DESSERTS_PRICE
}

/** Lunch + delivery only (no dessert) — for cart line breakdown */
export function calculateLunchLineTotal(day: {
  selectedDishes: string[]
  quantity: number
}): number {
  if (!isCompleteLunchSelection(day.selectedDishes)) return 0
  return PRICE_DISHES * day.quantity + DELIVERY_FEE * day.quantity
}

export function calculateDayLineTotal(day: {
  selectedDishes: string[]
  quantity: number
  dessertQuantity?: number
}): number {
  const lunch = calculateLunchLineTotal(day)
  if (!lunch) return 0
  return lunch + calculateDessertLineTotal(day.dessertQuantity ?? 0)
}

export function calculateOrderTotal(
  orderDays: Array<{
    selectedDishes: string[]
    quantity: number
    dessertQuantity?: number
  }>,
): number {
  return orderDays.reduce((sum, day) => sum + calculateDayLineTotal(day), 0)
}

/** Enforce: dessertQuantity > 0 requires complete lunch that day. */
export function sanitizeOrderDayDesserts<T extends OrderDay>(day: T): T {
  const dessertQuantity = normalizeDessertQuantity(day.dessertQuantity)
  if (!isCompleteLunchSelection(day.selectedDishes)) {
    return { ...day, dessertQuantity: 0 }
  }
  return { ...day, dessertQuantity }
}
