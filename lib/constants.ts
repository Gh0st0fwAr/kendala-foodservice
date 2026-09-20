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
