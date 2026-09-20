"use client"

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"

import { DayMenu } from "@/lib/order-types"
import { markPositionalDessert } from "@/lib/menu-excel"

import { commonApi, dropboxApi, menuApi, Order, ordersApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/components/language-provider"
import {
  ORDER_START_HOUR,
  ORDER_START_MINUTS,
  TEST_INDEX,
  BANNER,
} from "@/lib/constants"
import { getMockDate } from "@/lib/mock-time"
import {
  QR_MENU_DAYS,
  dropboxFilePublicUrl,
  matchQrMenuDayFromFileName,
  preferRasterDropboxEntries,
  withCacheBust,
  type QrMenuDayNum,
} from "@/lib/qr-menu"

type WeekDay = {
  day: string
  date: string
}

export type QrMenuImage = { day: QrMenuDayNum; url: string; dlId: string }

interface OrdersContextType {
  orders: Order[]
  setOrders: (orders: Order[]) => void
  menu: DayMenu[]
  setMenu: (menu: DayMenu[]) => void
  token: string | undefined
  setToken: (token: string | undefined) => void
  hash: string | undefined
  setHash: (token: string | undefined) => void
  getOrders: () => Promise<void>
  getMenu: (currentWeekDays: WeekDay[]) => Promise<void>
  getCurrentWeekDays: () => WeekDay[]
  isMaintenanceMode: boolean
  setIsMaintenanceMode: (status: boolean) => void
  isBannerVisible: boolean
  setIsBannerVisible: (status: boolean) => void
  banner: { url: string; dlId: string } | null
  setBanner: (banner: { url: string; dlId: string } | null) => void
  /** QR day images from the same dropbox select as banner */
  qrMenuImages: Partial<Record<QrMenuDayNum, QrMenuImage>>
  loadBanner: () => Promise<void>
  isLoadingBanner: boolean
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined)

export const OrdersProvider: React.FC<{
  initialToken: string | undefined
  initialHash: string | undefined
  children: React.ReactNode
}> = ({ initialToken = undefined, initialHash = undefined, children }) => {
  const { t } = useLanguage()
  const { toast } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [isBannerVisible, setIsBannerVisible] = useState(true)
  const [banner, setBanner] = useState<{ url: string; dlId: string } | null>(null)
  const [qrMenuImages, setQrMenuImages] = useState<
    Partial<Record<QrMenuDayNum, QrMenuImage>>
  >({})
  const [menu, setMenu] = useState<DayMenu[]>([])
  const [token, setToken] = useState<string | undefined>(initialToken)
  const [hash, setHash] = useState<string | undefined>(initialHash)
  const [initialized, setInitialized] = useState(false)
  const [isLoadingBanner, setIsLoadingBanner] = useState(false)
  const pathname = usePathname()

  const getMenu = async (currentWeekDays: WeekDay[]) => {
    // отправляем запрос на получение кода
    const res = await menuApi.getMenu()
    const resData = res?.data

    if (currentWeekDays?.length && resData) {
      const menu: DayMenu[] = currentWeekDays.map((day, indexDay) => {
        return {
          day: day.day,
          date: day.date,
          dishes: markPositionalDessert(
            resData.reduce((arrNew: DayMenu["dishes"], elem, index) => {
              if (indexDay + 1 === elem.day) {
                arrNew.push({
                  id: `${index + 1}`,
                  name: elem.name,
                  description: elem.description,
                  calories: elem.calories,
                  type: elem.type,
                  day: elem.day,
                })
              }
              return arrNew
            }, []),
          ),
        }
      })
      const noAvailableDaysMenu = getNoAvailableDays(menu)
      setMenu(noAvailableDaysMenu)
    } else {
      toast({
        title: t("common.error"),
        description: res.error || "Unknown error",
        variant: "destructive",
      })
    }
  }

  function getNoAvailableDays(menu: DayMenu[]) {
    const now = getMockDate()
    const currentDay = now.getDay()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const isAfterOrderStart =
      hours > ORDER_START_HOUR ||
      (hours === ORDER_START_HOUR && minutes >= ORDER_START_MINUTS)
    const effectiveDay = currentDay === 0 ? 7 : currentDay

    const blockDaysMenu = menu.map((item, numberDay) => {
      if (TEST_INDEX === 1) {
        if (numberDay + 1 < effectiveDay) {
          return {
            ...item,
            isAvailable: false,
          }
        }
        if (isAfterOrderStart && numberDay + 1 === effectiveDay) {
          return {
            ...item,
            isAvailable: false,
          }
        }
      }
      return {
        ...item,
        isAvailable: item.dishes.length === 0 ? false : true,
      }
    })
    return blockDaysMenu
  }

  function getCurrentWeekDays() {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday"]

    const today = getMockDate()
    const nextDay = today.getDay() // 0 (вс) - 6 (сб)
    const diffToMonday = (nextDay + 6) % 7 // сдвиг к понедельнику

    const monday = new Date(today)
    monday.setDate(today.getDate() - diffToMonday)

    const currentWeek = days.map((day, index) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + index)
      return {
        day,
        date: date.toISOString().split("T")[0], // формат YYYY-MM-DD
      }
    })
    return currentWeek
  }

  const getOrders = async () => {
    try {
      const res = await ordersApi.getOrders({
        token: token,
        u_hash: hash,
      })

      if (res.success) {
        const orders: Order[] = []
        Object.values(res?.data?.data.booking).forEach((elem: any) => {
          const id = elem.b_id
          const status = elem.b_start_address
          const orderFromServer = elem.b_options?.tickets?.seats[123][TEST_INDEX]
          if (orderFromServer?.customer) {
            const order: Order = { id, ...orderFromServer, status }
            orders.push(order)
          }
        })

        setOrders(orders)
      } else {
        toast({
          title: t("common.error"),
          description: res.error || "Не удалось загрузить заказы",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: t("common.error"),
        description: "Ошибка при загрузке заказов",
        variant: "destructive",
      })
    }
  }

  const getSiteStatus = async () => {
    try {
      const res = await commonApi.getSiteStatus()

      if (res.success) {
        setIsMaintenanceMode(!!res.data)
      } else {
        setIsMaintenanceMode(false)
      }
    } catch (error) {
      setIsMaintenanceMode(false)
      console.error(error)
    }
  }

  const getBannerStatus = async () => {
    try {
      const res = await commonApi.getBannerStatus()

      if (res.success) {
        setIsBannerVisible(!!res.data.value)
      } else {
        setIsBannerVisible(false)
      }
    } catch (error) {
      setIsBannerVisible(false)
      console.error(error)
    }
  }

  const loadBanner = useCallback(async () => {
    setIsLoadingBanner(true)
    try {
      const res = await dropboxApi.getFiles({ private: "-1" })
      if (!res.success) {
        setBanner(null)
        setQrMenuImages({})
        return
      }

      const filesMap =
        res.data?.data?.["dropbox files"] ?? res.data?.["dropbox files"] ?? undefined

      if (!filesMap || typeof filesMap !== "object") {
        setBanner(null)
        setQrMenuImages({})
        return
      }

      const entries = Object.values(filesMap) as Array<{
        dl_id?: string
        json?: { name?: string; name_upload?: string }
      }>

      const match = entries.find((entry) => {
        const name = entry.json?.name || entry.json?.name_upload || ""
        const base = name.split(".")[0]?.toLowerCase()
        return base === BANNER.toLowerCase()
      })

      if (match?.dl_id) {
        setBanner({
          url: withCacheBust(dropboxFilePublicUrl(match.dl_id), match.dl_id),
          dlId: match.dl_id,
        })
      } else {
        setBanner(null)
      }

      // Same select → QR day slots (prefer jpg/png over leftover svg)
      const byDay: Partial<Record<QrMenuDayNum, Array<{
        dl_id?: string
        json?: { name?: string; name_upload?: string }
      }>>> = {}
      for (const entry of entries) {
        const name = entry.json?.name || entry.json?.name_upload || ""
        const day = matchQrMenuDayFromFileName(name)
        if (day && entry.dl_id) {
          if (!byDay[day]) byDay[day] = []
          byDay[day]!.push(entry)
        }
      }
      const nextQr: Partial<Record<QrMenuDayNum, QrMenuImage>> = {}
      for (const d of QR_MENU_DAYS) {
        const best = preferRasterDropboxEntries(byDay[d.day] || [])
        if (best?.dl_id) {
          nextQr[d.day] = {
            day: d.day,
            dlId: String(best.dl_id),
            url: withCacheBust(dropboxFilePublicUrl(String(best.dl_id)), String(best.dl_id)),
          }
        } else {
          nextQr[d.day] = {
            day: d.day,
            dlId: `local-${d.day}`,
            url: `/qr-placeholders/menu-azure-${d.day}.svg`,
          }
        }
      }
      setQrMenuImages(nextQr)
    } catch (error) {
      console.error(error)
      setBanner(null)
      setQrMenuImages({})
    } finally {
      setIsLoadingBanner(false)
    }
  }, [])

  useEffect(() => {
    if (token && hash) {
      getOrders()
    }
    setInitialized(true)
  }, [token, hash])

  useEffect(() => {
    getSiteStatus()
    getBannerStatus()
    const currentWeekDays = getCurrentWeekDays()
    if (currentWeekDays?.length) getMenu(currentWeekDays)
  }, [])

  useEffect(() => {
      void loadBanner()
  }, [])

  if (!initialized) {
    return null // или <Spinner/>
  }

  return (
    <OrdersContext.Provider
      value={{
        orders,
        setOrders,
        menu,
        setMenu,
        token,
        setToken,
        hash,
        setHash,
        getOrders,
        getMenu,
        getCurrentWeekDays,
        isMaintenanceMode,
        setIsMaintenanceMode,
        isBannerVisible,
        setIsBannerVisible,
        banner,
        setBanner,
        qrMenuImages,
        loadBanner,
        isLoadingBanner
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}

export function useOrders() {
  const context = useContext(OrdersContext)
  if (context === undefined) {
    throw new Error("useOrders must be used within a OrdersProvider")
  }
  return context
}
