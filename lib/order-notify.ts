import { DESSERTS_PRICE, PRICE_DISHES } from "@/lib/constants"
import { normalizeDessertQuantity } from "@/lib/dessert"
import type { DayMenu } from "@/lib/order-types"
import type { Order } from "@/lib/api"

export interface ProcessedOrderDay {
  day: string
  date: string
  selectedDishes: string[]
  deliveryTime: string
  quantity: number
  dessertQuantity: number
  dessertName?: string
  price: string
  note?: string
}

export function buildDishNameMap(menu: DayMenu[]): Record<string, string> {
  return menu.reduce((ret: Record<string, string>, menuDay: DayMenu) => {
    menuDay.dishes.forEach((dish) => {
      if (dish.id && dish.name) ret[dish.id] ||= dish.name
    })
    return ret
  }, {})
}

export function findDessertNameForDay(menu: DayMenu[], dayKey: string): string | undefined {
  const dayMenu = menu.find((m) => m.day === dayKey)
  if (!dayMenu) return undefined
  const byType = dayMenu.dishes.find((d) => {
    const t = (d.type || "").toLowerCase()
    return t === "dessert" || t === "десерт"
  })
  if (byType?.name) return byType.name
  if (dayMenu.dishes[8]?.name) return dayMenu.dishes[8].name
  return undefined
}

/** Pure transform used by notify + tests */
export function processOrderDaysForNotify(
  order: Order,
  menu: DayMenu[],
): ProcessedOrderDay[] {
  const dishes = buildDishNameMap(menu)

  return order.orderDays.map((day) => {
    const dessertQuantity = normalizeDessertQuantity(
      (day as { dessertQuantity?: number }).dessertQuantity ?? 0,
    )
    const dessertName = findDessertNameForDay(menu, day.day)
    const lunchTotal = PRICE_DISHES * day.quantity
    const dessertTotal = dessertQuantity * DESSERTS_PRICE
    const dishNames = day.selectedDishes.map((dishId) => dishes[dishId] || "—")
    if (dessertQuantity > 0 && dessertName) {
      dishNames.push(`${dessertName} ×${dessertQuantity}`)
    } else if (dessertQuantity > 0) {
      dishNames.push(`Десерт ×${dessertQuantity}`)
    }

    return {
      day: day.day,
      date: day.date,
      selectedDishes: dishNames,
      deliveryTime: day.deliveryTime,
      quantity: day.quantity,
      dessertQuantity,
      dessertName,
      price: `${lunchTotal + dessertTotal} тг`,
      note: day.note,
    }
  })
}
