import { describe, expect, it } from "vitest"
import { processOrderDaysForNotify } from "@/lib/order-notify"
import { DESSERTS_PRICE, PRICE_DISHES } from "@/lib/constants"
import type { Order } from "@/lib/api"
import type { DayMenu } from "@/lib/order-types"

const menu: DayMenu[] = [
  {
    day: "monday",
    date: "2026-09-21",
    dishes: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: String(i + 1),
        name: `Dish${i + 1}`,
      })),
      { id: "9", name: "Тирамису", type: "dessert" },
    ],
  },
]

describe("processOrderDaysForNotify", () => {
  it("includes dessert name and price in day line", () => {
    const order: Order = {
      customer: {
        fullName: "Test",
        phone: "7700",
        office: "1",
        floor: "2",
        company: "Co",
      },
      orderDays: [
        {
          day: "monday",
          date: "2026-09-21",
          selectedDishes: ["1", "3", "5", "7"],
          deliveryTime: "12:00",
          quantity: 2,
          dessertQuantity: 3,
        },
      ],
      paymentMethod: "cash",
      total: 0,
      timestamp: "2026-09-20T10:00:00.000Z",
    }

    const days = processOrderDaysForNotify(order, menu)
    expect(days[0].selectedDishes).toContain("Тирамису ×3")
    expect(days[0].price).toBe(`${PRICE_DISHES * 2 + DESSERTS_PRICE * 3} тг`)
    expect(days[0].dessertQuantity).toBe(3)
  })
})
