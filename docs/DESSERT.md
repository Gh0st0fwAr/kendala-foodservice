# Десерт (TZ) — тесты и запуск

## Запуск тестов

Из папки проекта:

```bash
cd "g:\Резюме и проекты\Фриланс\Kwork\Проекты\kendala-foodservice"
npm test
```

Watch-режим:

```bash
npm run test:watch
```

## Где лежат тесты

| Файл | Что покрывает |
|------|----------------|
| `lib/dessert.test.ts` | цена 690, тотал по дням, sanitize, слот десерта |
| `lib/menu-excel.test.ts` | парсер Excel (8/9 строк, type=dessert) |
| `lib/order-notify.test.ts` | JSON→уведомление: имя десерта и сумма |

Конфиг: `vitest.config.ts`  
Скрипт: `"test": "vitest run"` в `package.json`

## Excel для админа

На каждый день (1–5):

1. 8 строк ланча как раньше (салат×2, суп×2, горячее×2, напиток×2)
2. **9-я строка** = десерт дня  
   **или** колонка `type` / `category` = `dessert`

## TEMP: воскресенье / локальный тест дней

В `lib/constants.ts`:

```ts
export const DEV_FORCE_MONDAY_MORNING = true // !!! снять перед продом
```

Пока `true`, сайт считает время **понедельником 10:00** (`2026-09-21`), чтобы дни не были заблокированы.  
Перед сдачей заказчику → **`false`**.

Альтернатива без флага: `http://localhost:3000/?mockTime=2026-09-21T10:00:00`
