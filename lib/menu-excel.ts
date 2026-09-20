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

function rowType(row: MenuExcelRow): string {
  return String(row.type || row.category || "")
    .toLowerCase()
    .trim()
}

/**
 * Normalize sheet_to_json rows.
 * Existing format: day, name, description, calories — 8 rows/day (lunch).
 * Minimal dessert extension: 9th row per day OR type/category = dessert.
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
    const type = typeRaw != null && String(typeRaw).trim() ? String(typeRaw).trim() : undefined
    const calories = r.calories != null && r.calories !== "" ? Number(r.calories) : undefined
    dishes.push({
      day,
      name,
      description: r.description != null ? String(r.description) : undefined,
      calories: Number.isFinite(calories as number) ? (calories as number) : undefined,
      type,
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
    const lunchRows = dayRows.filter((d) => {
      const t = (d.type || "").toLowerCase()
      return t !== "dessert" && t !== "десерт"
    })
    const dessertRows = dayRows.filter((d) => {
      const t = (d.type || "").toLowerCase()
      return t === "dessert" || t === "десерт"
    })

    if (lunchRows.length < LUNCH_DISH_SLOTS && dayRows.length < LUNCH_DISH_SLOTS) {
      warnings.push(
        `День ${day}: меньше ${LUNCH_DISH_SLOTS} позиций ланча (сейчас ${lunchRows.length || dayRows.length})`,
      )
    }

    // Positional dessert: 9th lunch-ordered row without type
    if (dessertRows.length === 0 && dayRows.length > DESSERT_SLOT_INDEX) {
      warnings.push(
        `День ${day}: 9-я позиция будет использована как десерт дня (индекс ${DESSERT_SLOT_INDEX})`,
      )
    }
    if (dessertRows.length === 0 && dayRows.length === LUNCH_DISH_SLOTS) {
      warnings.push(`День ${day}: десерт не указан — на сайте доп.позиция будет недоступна`)
    }
    if (dessertRows.length > 1) {
      warnings.push(`День ${day}: несколько dessert — будет взят первый`)
    }
  }

  return { ok: true, errors, warnings, dishes }
}

/** Attach synthetic type=dessert to positional 9th item when building DayMenu dishes list for a day */
export function markPositionalDessert(dishesForDay: Dish[]): Dish[] {
  return dishesForDay.map((d, index) => {
    if (index === DESSERT_SLOT_INDEX && !d.type) {
      return { ...d, type: "dessert" }
    }
    return d
  })
}
