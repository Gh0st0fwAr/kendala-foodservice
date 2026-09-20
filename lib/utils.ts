import { DayMenu } from "@/lib/order-types"
import { calculateDayLineTotal, calculateOrderTotal as calcOrderTotal } from "@/lib/dessert"
import { DELIVERY_FEE, PRICE_DISHES } from "@/lib/constants"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Time utilities
export const timeUtils = {
  isOrderingAllowed(targetDate: Date): boolean {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())

    // Same day - must order before 11:00
    if (target.getTime() === today.getTime()) {
      return now.getHours() < 11
    }

    // Next day - must order before 17:00 of previous day
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (target.getTime() === tomorrow.getTime()) {
      return now.getHours() < 17
    }

    // Future dates are allowed
    return target > tomorrow
  },

  formatDeliveryTime(time: string): string {
    return time.substring(0, 5) // Remove seconds if present
  },

  getWeekDays(): Array<{ key: string; name: string }> {
    return [
      { key: "monday", name: "Понедельник" },
      { key: "tuesday", name: "Вторник" },
      { key: "wednesday", name: "Среда" },
      { key: "thursday", name: "Четверг" },
      { key: "friday", name: "Пятница" },
    ]
  },
}

// Price calculations
export const priceUtils = {
  calculateMealPrice(dishCount: number): number {
    if (dishCount === 4) return PRICE_DISHES
    return 0
  },

  calculateDeliveryFee(): number {
    return DELIVERY_FEE
  },

  calculateOrderTotal(
    orderDays: Array<{
      selectedDishes: string[]
      quantity: number
      dessertQuantity?: number
    }>,
  ): number {
    return calcOrderTotal(orderDays)
  },

  calculateDayTotal(
    day: {
      selectedDishes: string[]
      quantity: number
      dessertQuantity?: number
    },
  ): number {
    return calculateDayLineTotal(day)
  },

  formatPrice(amount: number): string {
    return `${amount.toLocaleString("ru-RU")} ₸`
  },
}

// re-export for callers that imported DayMenu via utils historically
export type { DayMenu }
