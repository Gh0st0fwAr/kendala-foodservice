/**
 * Shared order/menu types for dessert + lunch flow.
 * Kept outside app/page.tsx so server notify and tests can import them.
 */

export interface Dish {
  id: string
  name: string
  description?: string
  calories?: number
  /** Optional Excel column: salad|soup|main|drink|dessert */
  type?: string
  day?: number
}

export interface DayMenu {
  day: string
  date: string
  dishes: Dish[]
  isAvailable?: boolean
}

export interface OrderDay {
  day: string
  date: string
  selectedDishes: string[]
  deliveryTime: string
  quantity: number
  /** Desserts for this day only; independent from lunch quantity */
  dessertQuantity: number
  note?: string
}

/** First 8 slots per day = lunch (2+2+2+2). Index 8 = dessert of the day. */
export const LUNCH_DISH_SLOTS = 8
export const DESSERT_SLOT_INDEX = 8
