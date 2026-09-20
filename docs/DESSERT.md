# Десерт (TZ) — тесты и запуск

## Запуск тестов

```bash
cd "g:\Резюме и проекты\Фриланс\Kwork\Проекты\kendala-foodservice"
npm test
```

## Где лежат тесты

| Файл | Что покрывает |
|------|----------------|
| `lib/dessert.test.ts` | 690, тотал, sanitize, parity цен с main (нет тарифов 2/3) |
| `lib/menu-excel.test.ts` | контракт type-порядка, отказ от «голой» 9-й строки |
| `lib/client-mock-menu.test.ts` | JSON + реальный `.xlsx` → DayMenu → notify |
| `lib/order-notify.test.ts` | имя десерта и сумма в уведомлении |

## Excel для админа (контракт)

Колонки: `day`, `name`, `description`, `calories`, `type`.

На день (1–5), если `type` заполнен:

```
salad, salad, soup, soup, main, main, drink, drink, dessert
```

- Цена десерта **только** `DESSERTS_PRICE` (690) в коде — `description` не парсится.
- Без `type` допускается классический ланч из 8 строк (warning: нет десерта).
- 9-я строка **без** `type=dessert` при загрузке **отклоняется** (не молчаливый positional).

Runtime `getDessertDish` ещё умеет взять 9-й слот у уже залитых меню без type — только страховка.

## Цены ланча

Как на main до десерта: `PRICE_DISHES` (3690) только при 4 выбранных слотах (3 блюда + напиток). Отдельных цен «2/3 блюда» в коде нет. Доставка `DELIVERY_FEE` × quantity.

## Локальный тест дней

Хардлока понедельника в коде нет. Для отладки только URL: `/?mockTime=2026-09-21T10:00:00`
