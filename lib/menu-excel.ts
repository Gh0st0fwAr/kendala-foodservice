import { DESSERT_SLOT_INDEX, LUNCH_DISH_SLOTS, type Dish } from "@/lib/order-types"

export type MenuExcelRow = {
  day: number
  name: string
  description?: string
  calories?: number
  type?: string
  category?: string
}

export type MenuExcelValidation = {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** Flattened dishes ready to stringify into lang_vls.dishes */
  dishes: Array<{
    day: number
    name: string
    description?: string
    calories?: number
    type?: string
  }>
}

/** Canonical day contract when `type` is filled. Price is never read from Excel. */
export const EXPECTED_DAY_TYPES = [
  "salad",
  "salad",
  "soup",
  "soup",
  "main",
  "main",
  "drink",
  "drink",
  "dessert",
] as const

export type CanonicalDishType = (typeof EXPECTED_DAY_TYPES)[number]

const TYPE_ALIASES: Record<string, CanonicalDishType> = {
  salad: "salad",
  салат: "salad",
  soup: "soup",
  суп: "soup",
  main: "main",
  горячее: "main",
  hot: "main",
  drink: "drink",
  напиток: "drink",
  dessert: "dessert",
  десерт: "dessert",
}

export function normalizeDishType(raw: unknown): CanonicalDishType | null {
  if (raw == null || raw === "") return null
  const key = String(raw).toLowerCase().trim()
  return TYPE_ALIASES[key] ?? null
}

function isDessertType(t: string | undefined): boolean {
  const n = normalizeDishType(t)
  return n === "dessert"
}

/**
 * Parse sheet_to_json rows.
 * Contract (preferred): day + type in order salad×2, soup×2, main×2, drink×2, dessert×1.
 * Classic untyped 8 lunch rows still accepted (warning: no dessert).
 * Untyped 9th row is rejected — require type=dessert (no silent positional dessert on upload).
 * `description` is kept as text only; price must stay in app constants (DESSERTS_PRICE).
 */
export function parseMenuExcelRows(raw: unknown[]): MenuExcelValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const dishes: MenuExcelValidation["dishes"] = []

  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, errors: ["Excel пустой или не распознан"], warnings, dishes }
  }

  raw.forEach((row, index) => {
    const r = row as Record<string, unknown>
    const day = Number(r.day)
    const name = String(r.name ?? "").trim()
    if (!Number.isInteger(day) || day < 1 || day > 5) {
      errors.push(`Строка ${index + 1}: day должен быть 1..5`)
      return
    }
    if (!name) {
      errors.push(`Строка ${index + 1}: пустое name`)
      return
    }
    const typeRaw = r.type ?? r.category
    const typeNormalized = normalizeDishType(typeRaw)
    if (typeRaw != null && String(typeRaw).trim() && !typeNormalized) {
      errors.push(
        `Строка ${index + 1}: неизвестный type «${String(typeRaw)}» (ожидаются salad/soup/main/drink/dessert)`,
      )
      return
    }
    const calories = r.calories != null && r.calories !== "" ? Number(r.calories) : undefined
    dishes.push({
      day,
      name,
      description: r.description != null ? String(r.description) : undefined,
      calories: Number.isFinite(calories as number) ? (calories as number) : undefined,
      // Persist canonical English type when known (keeps DayMenu / getDessertDish stable)
      type: typeNormalized ?? undefined,
    })
  })

  if (errors.length) {
    return { ok: false, errors, warnings, dishes }
  }

  for (let day = 1; day <= 5; day++) {
    const dayRows = dishes.filter((d) => d.day === day)
    if (dayRows.length === 0) {
      warnings.push(`День ${day}: нет строк меню`)
      continue
    }

    const typedCount = dayRows.filter((d) => d.type).length
    const allTyped = typedCount === dayRows.length
    const dessertRows = dayRows.filter((d) => isDessertType(d.type))
    const lunchRows = dayRows.filter((d) => !isDessertType(d.type))

    if (allTyped) {
      if (dayRows.length !== LUNCH_DISH_SLOTS && dayRows.length !== LUNCH_DISH_SLOTS + 1) {
        errors.push(
          `День ${day}: при заполненном type нужно ${LUNCH_DISH_SLOTS} (ланч) или ${LUNCH_DISH_SLOTS + 1} (ланч+десерт) строк, сейчас ${dayRows.length}`,
        )
        continue
      }
      const expected =
        dayRows.length === LUNCH_DISH_SLOTS
          ? EXPECTED_DAY_TYPES.slice(0, LUNCH_DISH_SLOTS)
          : EXPECTED_DAY_TYPES
      for (let i = 0; i < dayRows.length; i++) {
        const got = dayRows[i].type
        const want = expected[i]
        if (got !== want) {
          errors.push(
            `День ${day}, позиция ${i + 1}: type=${got ?? "∅"}, ожидается ${want} (контракт 2+2+2+2[+dessert])`,
          )
        }
      }
      continue
    }

    // Mixed / untyped legacy paths
    if (dessertRows.length > 1) {
      errors.push(`День ${day}: несколько строк dessert — оставьте одну`)
      continue
    }

    if (dessertRows.length === 1) {
      const dessertIndex = dayRows.findIndex((d) => isDessertType(d.type))
      if (dessertIndex !== DESSERT_SLOT_INDEX) {
        errors.push(
          `День ${day}: dessert должен быть 9-й строкой дня (сейчас позиция ${dessertIndex + 1}). Иначе слоты ланча 1–8 поедут.`,
        )
      }
      if (lunchRows.length !== LUNCH_DISH_SLOTS) {
        errors.push(
          `День ${day}: нужно ровно ${LUNCH_DISH_SLOTS} строк ланча перед dessert (сейчас ${lunchRows.length})`,
        )
      }
      // If lunch rows also have types, enforce lunch sequence
      if (lunchRows.every((d) => d.type) && lunchRows.length === LUNCH_DISH_SLOTS) {
        for (let i = 0; i < LUNCH_DISH_SLOTS; i++) {
          const want = EXPECTED_DAY_TYPES[i]
          if (lunchRows[i].type !== want) {
            errors.push(
              `День ${day}, позиция ${i + 1}: type=${lunchRows[i].type}, ожидается ${want}`,
            )
          }
        }
      }
      continue
    }

    // No typed dessert
    if (dayRows.length > LUNCH_DISH_SLOTS) {
      errors.push(
        `День ${day}: ${dayRows.length} строк без type=dessert. Укажите type=dessert на 9-й строке (позиционный десерт при загрузке больше не принимается).`,
      )
      continue
    }

    if (dayRows.length < LUNCH_DISH_SLOTS) {
      warnings.push(
        `День ${day}: меньше ${LUNCH_DISH_SLOTS} позиций ланча (сейчас ${dayRows.length})`,
      )
    } else {
      warnings.push(`День ${day}: десерт не указан — на сайте доп.позиция будет недоступна`)
    }

    if (typedCount > 0 && typedCount < dayRows.length) {
      warnings.push(
        `День ${day}: type заполнен не у всех строк — лучше указать type для всех 8/9 позиций`,
      )
    }
  }

  if (errors.length) {
    return { ok: false, errors, warnings, dishes }
  }

  return { ok: true, errors, warnings, dishes }
}

/**
 * Runtime helper for menus already in dropbox without type on the 9th dish.
 * Upload path no longer accepts untyped dessert — prefer type=dessert in Excel.
 */
export function markPositionalDessert(dishesForDay: Dish[]): Dish[] {
  return dishesForDay.map((d, index) => {
    if (index === DESSERT_SLOT_INDEX && !d.type) {
      return { ...d, type: "dessert" }
    }
    return d
  })
}
