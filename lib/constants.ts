export const PHONE_NUMBER = "+7 771 400 4404"

export const YANDEX_METRICA_ID = 104811447

export const ORDER_START_HOUR = 14
export const ORDER_START_MINUTS = 30

export const PRICE_DISHES = 3690
export const DELIVERY_FEE = 300
export const DESSERTS_PRICE = 690
export const PASTRIES_PRICE_MIN = 350

export const formatPrice = (amount: number) => `${amount.toLocaleString("ru-RU")} ₸`

type Mode = 1 | 2
type ModeNotif = 0 | 1
/**
 * 2 - для тестирования, 1 - для прода
 * в режиме тестирования отключается блокировка дней и загрузка заказов и меню не использует данные прода
 */
export const TEST_INDEX: Mode = 1

/**
 * 0 - отключение уведомлений на почту и телеграм, 1 - включение
 */
export const IS_SEND_NOTIFICATION: ModeNotif = 1

/**
 * количество отображаемых заказов
 */
export const LC = 20

export const BANNER = "banner-azure"

/**
 * !!! TEMP — снять перед финальной сдачей на прод без тестового времени !!!
 * true = время как понедельник 10:00 (удобно тестить, когда реальные дни уже «прошли»).
 * false = реальное время (или ?mockTime= в URL).
 */
export const DEV_FORCE_MONDAY_MORNING = true

/** ISO local wall-clock used when DEV_FORCE_MONDAY_MORNING is on */
export const DEV_FORCE_MONDAY_ISO = "2026-09-28T10:00:00"
