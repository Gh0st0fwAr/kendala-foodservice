"use client"

import { useState, useEffect, useRef } from "react"
import { Header } from "@/components/header"
import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Clock, ShoppingCart } from "lucide-react"
import { ordersApi } from "@/lib/api"
import cloneDeep from "lodash/cloneDeep"
import { useOrders } from "@/components/orders-provider"
import PhoneInput from "react-phone-input-2"
import "react-phone-input-2/lib/style.css"
import { reachGoal } from "@/lib/metrics/yandexMetrics"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import Image from "next/image"
import {
  ORDER_START_HOUR,
  ORDER_START_MINUTS,
  DESSERTS_PRICE,
  TEST_INDEX,
} from "@/lib/constants"
import { getMockDate, getMockTimeLabel } from "@/lib/mock-time"
import type { DayMenu, Dish, OrderDay } from "@/lib/order-types"
import {
  calculateLunchLineTotal,
  calculateOrderTotal,
  getDessertDish,
  getLunchDishGroups,
  normalizeDessertQuantity,
  sanitizeOrderDayDesserts,
} from "@/lib/dessert"
import { parseOrderDayParam } from "@/lib/qr-menu"

export type { DayMenu, Dish } from "@/lib/order-types"

export default function OrderPage() {
  const { t } = useLanguage()
  const { toast } = useToast()
  const { menu, setMenu, isMaintenanceMode, isBannerVisible, banner } = useOrders()
  const [orderDays, setOrderDays] = useState<OrderDay[]>([])
  const [customerInfo, setCustomerInfo] = useState({
    fullName: "",
    phone: "",
    office: "",
    floor: "",
    company: "",
  })
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "invoice">("cash")
  const [timeRestrictionMessage, setTimeRestrictionMessage] = useState("")
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false)
  const [isBannerReady, setIsBannerReady] = useState(false)
  const [bannerSize, setBannerSize] = useState<{ width: number; height: number } | null>(null)
  const [isBannerImageLoaded, setIsBannerImageLoaded] = useState(false)
  /** Remount PhoneInput after order reset — library locks input when value cleared to "" */
  const [phoneInputKey, setPhoneInputKey] = useState(0)
  const mockTimeLabel = getMockTimeLabel()
  const qrDayAppliedRef = useRef(false)

  useEffect(() => {
    const now = getMockDate()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    const isAfterOrderStart =
      hours > ORDER_START_HOUR || (hours === ORDER_START_HOUR && minutes >= ORDER_START_MINUTS)

    if (isAfterOrderStart) setTimeRestrictionMessage(t("order.orderClosed"))

    // Check if ordering is allowed based on current time
    const interval = setInterval(() => {
      const now = getMockDate()
      const currentDay = now.getDay()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const isAfterOrderStart =
        hours > ORDER_START_HOUR || (hours === ORDER_START_HOUR && minutes >= ORDER_START_MINUTS)

      if (isAfterOrderStart) setTimeRestrictionMessage(t("order.orderClosed"))
      if (TEST_INDEX === 1 && menu.length) {
        if (
          isAfterOrderStart &&
          currentDay >= 1 &&
          currentDay <= 5 &&
          menu[currentDay - 1]?.isAvailable !== false
        ) {
          const newMenu = cloneDeep(menu)
          newMenu[currentDay - 1].isAvailable = false
          setMenu(newMenu)
        }
      }
    }, 1000 * 60) // проверка каждую минуту

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!banner?.url || !isBannerVisible) {
      setIsBannerModalOpen(false)
      setIsBannerReady(false)
      setBannerSize(null)
      return
    }

    // Came from QR `/menu` with ?day= — afisha already shown there, don't open again
    if (
      typeof window !== "undefined" &&
      parseOrderDayParam(new URLSearchParams(window.location.search).get("day"))
    ) {
      setIsBannerModalOpen(false)
      setIsBannerReady(false)
      setBannerSize(null)
      return
    }

    let isActive = true
    setIsBannerReady(false)
    setIsBannerImageLoaded(false)
    const img = new window.Image()
    img.src = banner.url
    img.onload = () => {
      if (!isActive) return
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      if (width && height) {
        setBannerSize({ width, height })
      }
      setIsBannerReady(true)
      setIsBannerModalOpen(true)
    }
    img.onerror = () => {
      if (!isActive) return
      setIsBannerReady(false)
      setIsBannerImageLoaded(false)
      setIsBannerModalOpen(false)
    }

    return () => {
      isActive = false
    }
  }, [banner?.url, isBannerVisible])

  const getDayName = (day: string) => {
    return t(`day.${day}`)
  }

  const toggleDay = (dayMenu: DayMenu) => {
    const existingIndex = orderDays.findIndex((od) => od.day === dayMenu.day)

    if (existingIndex >= 0) {
      setOrderDays(orderDays.filter((_, index) => index !== existingIndex))
    } else {
      const firstDrinkId = dayMenu.dishes[6]?.id
      setOrderDays([
        ...orderDays,
        {
          day: dayMenu.day,
          date: dayMenu.date,
          selectedDishes: firstDrinkId ? [firstDrinkId] : [],
          deliveryTime: "12:00",
          quantity: 1,
          dessertQuantity: 0,
          note: "",
        },
      ])
    }
  }

  /** From QR `/menu?` → `/?day=tuesday|2`: select day and scroll to it */
  useEffect(() => {
    if (qrDayAppliedRef.current || !menu?.length) return
    if (typeof window === "undefined") return
    const dayKey = parseOrderDayParam(new URLSearchParams(window.location.search).get("day"))
    if (!dayKey) return

    const dayMenu = menu.find((m) => m.day === dayKey)
    if (!dayMenu || dayMenu.isAvailable === false) return

    qrDayAppliedRef.current = true

    setOrderDays((prev) => {
      if (prev.some((od) => od.day === dayKey)) return prev
      const firstDrinkId = dayMenu.dishes[6]?.id
      return [
        ...prev,
        {
          day: dayMenu.day,
          date: dayMenu.date,
          selectedDishes: firstDrinkId ? [firstDrinkId] : [],
          deliveryTime: "12:00",
          quantity: 1,
          dessertQuantity: 0,
          note: "",
        },
      ]
    })

    const scroll = () => {
      document.getElementById(`order-day-${dayKey}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
    // After paint; retry once if banner modal delayed layout
    requestAnimationFrame(scroll)
    const t = window.setTimeout(scroll, 600)
    return () => window.clearTimeout(t)
  }, [menu])

  const handleChange = (value: string) => {
    setCustomerInfo((prev) => ({ ...prev, phone: value.replace(/\D/g, "") }))
  }

  const updateOrderDay = (day: string, updates: Partial<OrderDay>) => {
    const hours = updates.deliveryTime?.slice(0, 2)
    if ((hours && +hours < 12) || (hours && +hours >= 16)) {
      toast({
        title: t("common.error"),
        description: t("order.toast.deliveryTimeRange"),
        variant: "destructive",
      })
    }
    setOrderDays(
      orderDays.map((od) =>
        od.day === day ? sanitizeOrderDayDesserts({ ...od, ...updates }) : od,
      ),
    )
  }

  const selectDish = (
    day: string,
    dishId: string,
    groupDishIds: string[],
    isMandatoryGroup: boolean,
  ) => {
    const orderDay = orderDays.find((od) => od.day === day)
    if (!orderDay) return

    const currentDishes = orderDay.selectedDishes
    const isSelected = currentDishes.includes(dishId)

    let newDishes: string[]
    if (isSelected) {
      if (isMandatoryGroup) {
        toast({
          title: t("common.error"),
          description: t("order.toast.drinkRequired"),
          variant: "destructive",
        })
        return
      }
      newDishes = currentDishes.filter((id) => id !== dishId)
    } else {
      const withoutGroup = currentDishes.filter((id) => !groupDishIds.includes(id))
      if (withoutGroup.length >= 4) {
        toast({
          title: t("common.error"),
          description: t("order.toast.maxThreeDishes"),
          variant: "destructive",
        })
        return
      }
      newDishes = [...withoutGroup, dishId]
    }

    updateOrderDay(day, { selectedDishes: newDishes })
  }

  const setDessertQuantity = (day: string, value: number) => {
    const orderDay = orderDays.find((od) => od.day === day)
    if (!orderDay) return
    const next = sanitizeOrderDayDesserts({
      ...orderDay,
      dessertQuantity: normalizeDessertQuantity(value),
    })
    updateOrderDay(day, { dessertQuantity: next.dessertQuantity })
  }

  const calculateTotal = () => calculateOrderTotal(orderDays)

  const canSubmitOrder = () => {
    if (!customerInfo.fullName || !customerInfo.phone || !customerInfo.office) {
      return false
    }
    return true
  }

  const canSubmitOrderThreeDishes = () => {
    return (
      orderDays.every((od) => {
        const dayMenu = menu.find((m) => m.day === od.day)
        const drinkIds = dayMenu?.dishes.slice(6, 8).map((dish) => dish.id) || []
        const hasDrink = drinkIds.some((id) => od.selectedDishes.includes(id))
        return od.selectedDishes.length === 4 && od.deliveryTime && od.quantity > 0 && hasDrink
      }) && orderDays.length > 0
    )
  }

  const getRequiredGroupWarning = (dayMenu: DayMenu, orderDay?: OrderDay) => {
    if (!orderDay) return ""
    const selected = orderDay.selectedDishes
    const saladIds = dayMenu.dishes.slice(0, 2).map((dish) => dish.id)
    const soupIds = dayMenu.dishes.slice(2, 4).map((dish) => dish.id)
    const mainIds = dayMenu.dishes.slice(4, 6).map((dish) => dish.id)
    const hasSalad = saladIds.some((id) => selected.includes(id))
    const hasSoup = soupIds.some((id) => selected.includes(id))
    const hasMain = mainIds.some((id) => selected.includes(id))
    if (hasSalad && hasSoup && hasMain) return ""
    return t("order.requiredCoreDishes")
  }

  const submitOrder = async () => {
    if (!canSubmitOrder()) {
      toast({
        title: t("common.error"),
        description: t("order.toast.fillRequired"),
        variant: "destructive",
      })
      return
    }
    if (!canSubmitOrderThreeDishes()) {
      toast({
        title: t("common.error"),
        description: t("order.toast.minThreeDishes"),
        variant: "destructive",
      })
      return
    }

    const sanitizedDays = orderDays.map((d) => sanitizeOrderDayDesserts(d))
    const orderData = {
      customer: customerInfo,
      orderDays: sanitizedDays,
      paymentMethod,
      total: calculateOrderTotal(sanitizedDays),
      timestamp: new Date().toISOString(),
    }

    reachGoal("createOrder")
    const res = await ordersApi.createOrder(orderData, menu)

    if (res.success) {
      toast({
        title: t("common.success"),
        description: t("order.toast.success"),
      })
    } else {
      toast({
        title: t("common.error"),
        description: res.error || t("order.toast.submitError"),
        variant: "destructive",
      })
      return
    }

    // Reset form
    setOrderDays([])
    setCustomerInfo({
      fullName: "",
      phone: "",
      office: "",
      floor: "",
      company: "",
    })
    setPhoneInputKey((k) => k + 1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#87CEEB] via-[#B0E0E6] to-[#87CEEB]">
      <Header />

      <Dialog open={isMaintenanceMode} aria-labelledby="maintenance-modal">
        <DialogContent
          showCloseButton={false}
          closeOnOutsideClick={false}
          className="max-w-md bg-white shadow-lg rounded-lg"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Технические работы</DialogTitle>
            <DialogDescription>
              Сайт временно недоступен для заказов из-за технических работ.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 text-center">
            <Image
              src="warning-order.jpg"
              alt="Сайт временно недоступен для заказов"
              width={250}
              height={250}
            />
            <div className="space-y-4 text-sm text-gray-800">
              <p>
                <strong>RU:</strong> Ведутся технические работы. Мы уже восстанавливаем сервис и
                скоро вернемся. Извините за неудобства.
              </p>
              <p>
                <strong>KZ:</strong> Техникалық жұмыстар жүргізілуде. Қызметті қалпына келтіріп
                жатырмыз, жақында ораламыз. Қолайсыздықтар үшін кешірім сұраймыз.
              </p>
              <p>
                <strong>EN:</strong> Under maintenance. We are currently fixing the service and will
                be back shortly. We apologize for the inconvenience.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Modal
        open={isBannerModalOpen && isBannerReady}
        onOpenChange={(open) => {
          setIsBannerModalOpen(open)
        }}
        aria-labelledby="maintenance-modal"
      >
          <ModalContent
          className="p-0 overflow-hidden w-auto max-w-none"
        >
          <ModalHeader className="sr-only">
            <ModalTitle>Баннер</ModalTitle>
            <ModalDescription>Просмотр текущего промо-баннера.</ModalDescription>
          </ModalHeader>
          <div
            className={`flex flex-col transition-opacity duration-500 ease-out ${
              isBannerImageLoaded ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="bg-white overflow-hidden flex justify-center">
              {banner?.url && bannerSize && (
                <Image
                  src={banner.url}
                  alt="Акция"
                  width={bannerSize.width}
                  height={bannerSize.height}
                  className="block h-auto w-auto max-h-[80vh] max-w-[90vw] object-contain"
                  sizes="(max-width: 768px) 90vw, 640px"
                  priority
                  onLoad={() => setIsBannerImageLoaded(true)}
                />
              )}
            </div>
            {isBannerImageLoaded && (
              <ModalFooter className="px-0 pb-0 pt-0">
                <ModalClose asChild>
                  <Button className="w-full h-10 rounded-t-none">Ок</Button>
                </ModalClose>
              </ModalFooter>
            )}
          </div>
        </ModalContent>
      </Modal>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="rounded-xl border border-[#00A8E8]/30 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-[#003D82]">
              {t("order.hero.title")}
            </h1>
            <p className="text-xs sm:text-sm uppercase tracking-wide text-[#00A8E8] font-semibold">
              {t("order.hero.slogan")}
            </p>
            <p className="mt-3 text-sm sm:text-base text-[#003D82]/80">{t("order.hero.line1")}</p>
            <p className="mt-1 text-sm sm:text-base text-[#003D82]/80">{t("order.hero.line2")}</p>
            <div className="mt-4 rounded-lg border border-[#FF9F1C] bg-gradient-to-r from-[#FFF2E0] to-white px-4 py-3 text-sm text-[#7A3E00] shadow-sm">
              <p className="font-semibold">{t("order.weeklyBonus.title")}</p>
              <div className="mt-1 text-xs sm:text-sm text-[#7A3E00]/80">
                {t("order.weeklyBonus.subtitle")} {t("order.weeklyBonus.note1")},{" "}
                {t("order.weeklyBonus.note2")}
              </div>
            </div>
          </div>
          {timeRestrictionMessage && (
            <Alert className="bg-red-50 border-red-200 flex mt-4">
              <Clock className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{timeRestrictionMessage}</AlertDescription>
            </Alert>
          )}
          {mockTimeLabel && (
            <Alert className="bg-amber-50 border-amber-300 flex mt-4">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                ⏰ Mock time: {mockTimeLabel} — remove <code className="bg-amber-100 px-1 rounded">?mockTime=...</code> from URL to restore real time.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Menu Selection */}
          <div className="lg:col-span-2">
            <Card className="bg-[#003D82] border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-white mb-6">
                  {t("order.selectDishes")}
                </CardTitle>
                <div className="text-white text-sm mb-6 pb-4 border-b border-[#00A8E8]">
                  <span className="font-semibold">{t("order.pricedishes")}</span>
                  <span className="mx-4">•</span>
                  <span className="font-semibold">{t("order.deliveryFee")}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {menu?.map((dayMenu) => {
                  const orderDay = orderDays.find((od) => od.day === dayMenu.day)
                  const isSelected = !!orderDay

                  return (
                    <div
                      key={dayMenu.day}
                      id={`order-day-${dayMenu.day}`}
                      className={`rounded-lg p-4 border scroll-mt-24 ${
                        !dayMenu.isAvailable
                          ? "bg-gray-500 border-gray-600 text-gray-400 pointer-events-none"
                          : "bg-[#002855] border-[#00A8E8]"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                        <div className="flex items-center gap-3 sm:flex-row">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {
                              dayMenu.isAvailable && toggleDay(dayMenu)
                              reachGoal("checkedDay")
                            }}
                            disabled={!dayMenu.isAvailable}
                            className="border-[#00A8E8]"
                          />
                          <div>
                            <h3
                              className={`font-semibold ${
                                dayMenu.isAvailable
                                  ? "text-white"
                                  : "text-gray-400 pointer-events-none"
                              }`}
                            >
                              {getDayName(dayMenu.day)}
                            </h3>
                            <p
                              className={`text-sm text-gray-600 ${
                                !dayMenu.isAvailable ? "text-gray-400" : "text-white"
                              }`}
                            >
                              {dayMenu.date}
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex sm:flex-row justify-end items-center gap-4">
                            <div className="flex flex-col items-center">
                              <Label className="text-xs py-0.5 text-white">
                                {t("order.deliveryTime")}
                              </Label>
                              <select
                                value={orderDay.deliveryTime}
                                onChange={(e) =>
                                  updateOrderDay(dayMenu.day, {
                                    deliveryTime: e.target.value,
                                  })
                                }
                                className="bg-[#001F3F] w-full h-8 px-3 py-1 border border-[#00A8E8] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-black appearance-none text-white placeholder:text-[#87CEEB]"
                              >
                                <option value="12:00">12:00 - 12:30</option>
                                <option value="12:30">12:30 - 13:00</option>
                                <option value="13:00">13:00 - 13:30</option>
                                <option value="13:30">13:30 - 14:00</option>
                                <option value="14:00">14:00 - 14:30</option>
                                <option value="14:30">14:30 - 15:00</option>
                                <option value="15:00">15:00 - 15:30</option>
                                <option value="15:30">15:30 - 16:00</option>
                              </select>
                            </div>
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-white py-0.5">
                                {t("order.quantity")}
                              </Label>
                              <Input
                                type="number"
                                inputMode="numeric"
                                step="1"
                                value={orderDay.quantity}
                                onFocus={(e) => {
                                  e.target.value = ""
                                }}
                                onBlur={(e) => {
                                  const val = Number.parseInt(e.target.value, 10)
                                  if (!Number.isInteger(val) || val < 1) {
                                    updateOrderDay(dayMenu.day, {
                                      quantity: 1,
                                    })
                                  } else {
                                    updateOrderDay(dayMenu.day, {
                                      quantity: val,
                                    })
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "") return // не обновляем при пустом поле
                                  const parsed = Number.parseInt(value, 10)
                                  if (!Number.isNaN(parsed)) {
                                    updateOrderDay(dayMenu.day, {
                                      quantity: parsed,
                                    })
                                  }
                                }}
                                className="bg-[#001F3F] w-20 h-8 px-3 py-1 border border-[#00A8E8] rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-black appearance-none text-white placeholder:text-[#87CEEB]"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <>
                          <div className="grid gap-4">
                            {(() => {
                              const groups = getLunchDishGroups(dayMenu)
                              return [
                                {
                                  key: "salads",
                                  title: t("order.group.salads"),
                                  items: groups.salads,
                                },
                                {
                                  key: "soups",
                                  title: t("order.group.soups"),
                                  items: groups.soups,
                                },
                                {
                                  key: "mains",
                                  title: t("order.group.mains"),
                                  items: groups.mains,
                                },
                                {
                                  key: "drinks",
                                  title: t("order.group.drinks"),
                                  items: groups.drinks,
                                },
                              ]
                                .filter((group) => group.items.length > 0)
                                .map((group) => {
                                const groupDishIds = group.items.map((item) => item.id)
                                const isMandatoryGroup = group.key === "drinks"
                                return (
                                  <div key={group.key} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h4 className="text-sm font-semibold text-white">
                                        {group.title}
                                      </h4>
                                      <span className="text-xs text-[#87CEEB]">
                                        {t("order.group.oneOfTwo")}
                                      </span>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      {group.items.map((dish) => (
                                        <div
                                          key={dish.id}
                                          className={`bg-[#001F3F] border rounded p-3 cursor-pointer transition-colors ${
                                            orderDay.selectedDishes.includes(dish.id)
                                              ? "border-orange-500 bg-[#003366]"
                                              : "border-[#00A8E8]/30 md:hover:border-[#00A8E8] md:transition"
                                          }`}
                                          onClick={() => {
                                            selectDish(
                                              dayMenu.day,
                                              dish.id,
                                              groupDishIds,
                                              isMandatoryGroup,
                                            )
                                            reachGoal("selectDish")
                                          }}
                                        >
                                          <div className="flex h-full flex-col gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <h4 className="font-medium text-white">
                                                {dish.name}
                                              </h4>
                                            </div>
                                            {dish.description && (
                                              <p className="text-sm text-[#87CEEB] w-full">
                                                {dish.description}
                                              </p>
                                            )}
                                            {dish.calories !== undefined && (
                                              <Badge
                                                variant="secondary"
                                                className="mt-auto w-fit bg-[#00A8E8] text-white border-0"
                                              >
                                                {dish.calories} {t("common.calories")}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })
                            })()}
                          </div>

                          <div className="mt-4 rounded-md border border-[#00A8E8]/40 bg-[#001F3F] p-3 text-sm text-[#87CEEB] space-y-3">
                            {(() => {
                              const dessert = getDessertDish(dayMenu)
                              const lunchReady = (orderDay?.selectedDishes.length || 0) === 4
                              const dq = orderDay?.dessertQuantity || 0
                              if (!dessert) {
                                return (
                                  <>
                                    <p className="font-semibold text-white">{t("order.dessert.title")}</p>
                                    <p>{t("order.dessert.unavailable")}</p>
                                  </>
                                )
                              }
                              return (
                                <>
                                  <p className="font-semibold text-white">{t("order.dessert.title")}</p>
                                  <p>
                                    {dessert.name} —{" "}
                                    <span className="font-semibold text-white">
                                      {DESSERTS_PRICE} ₸
                                    </span>
                                  </p>
                                  <p className="text-xs">{t("order.dessert.hint")}</p>
                                  <div className="flex items-center gap-3">
                                    <Label className="text-white text-sm">
                                      {t("order.dessert.quantity")}
                                    </Label>
                                    <Input
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      step={1}
                                      disabled={!lunchReady}
                                      value={dq}
                                      onChange={(e) => {
                                        const parsed = Number.parseInt(e.target.value, 10)
                                        setDessertQuantity(
                                          dayMenu.day,
                                          Number.isNaN(parsed) ? 0 : parsed,
                                        )
                                      }}
                                      className="bg-[#003366] w-20 h-8 px-3 border border-[#00A8E8] text-white"
                                    />
                                  </div>
                                  {!lunchReady && (
                                    <p className="text-xs text-yellow-200">
                                      {t("order.dessert.needLunch")}
                                    </p>
                                  )}
                                </>
                              )
                            })()}
                            <div className="border-t border-[#00A8E8]/30 pt-2">
                              <p className="font-semibold text-white">{t("order.extras.title")}</p>
                              <p>
                                {t("order.extras.pastries")}{" "}
                                <span className="font-semibold text-white">
                                  {t("order.extras.pastriesPrice")}
                                </span>
                              </p>
                              <p className="mt-1 text-xs">{t("order.extras.note")}</p>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            <Label className="text-white text-sm">{t("order.note.title")}</Label>
                            <Textarea
                              value={orderDay?.note || ""}
                              onChange={(e) =>
                                updateOrderDay(dayMenu.day, {
                                  note: e.target.value,
                                })
                              }
                              placeholder={t("order.note.placeholder")}
                              className="min-h-[90px] bg-[#001F3F] border-[#00A8E8] text-white placeholder:text-[#87CEEB] text-sm sm:text-base placeholder:text-xs sm:placeholder:text-sm"
                            />
                          </div>
                        </>
                      )}
                      {(() => {
                        const warning = getRequiredGroupWarning(dayMenu, orderDay)
                        return warning ? (
                          <Alert className="mt-4 bg-yellow-900/30 border-yellow-600">
                            <AlertDescription className="text-yellow-200">
                              {warning}
                            </AlertDescription>
                          </Alert>
                        ) : null
                      })()}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          {/* Order Summary & Customer Info */}
          <div>
            <div className="space-y-4 sticky top-6">
              <Card className="bg-[#003D82] border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">
                    {t("order.customerInfo")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="fullName" className="text-white text-sm">
                      {t("order.fullName")} *
                    </Label>
                    <Input
                      id="fullName"
                      value={customerInfo.fullName}
                      onChange={(e) => {
                        setCustomerInfo({
                          ...customerInfo,
                          fullName: e.target.value,
                        })
                        reachGoal("setCustomerInfo")
                      }}
                      placeholder="Иванов Иван Иванович"
                      className="bg-[#001F3F] border-[#00A8E8] text-white placeholder:text-[#87CEEB]"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-white text-sm">
                      {t("order.phone")} *
                    </Label>
                    <PhoneInput
                      key={phoneInputKey}
                      country="kz"
                      preferredCountries={["kz"]}
                      excludeCountries={["ru"]}
                      value={customerInfo.phone}
                      onChange={handleChange}
                      enableSearch={true}
                      countryCodeEditable={false}
                      inputProps={{
                        name: "phone",
                        required: true,
                        autoFocus: false,
                        placeholder: "+7 (777) 123-45-67",
                        inputMode: "numeric",
                        pattern: "[0-9]*",
                      }}
                      inputClass="!h-10 !text-[16px] !text-[#87CEEB] !w-full !bg-[#001F3F] !border-[#00A8E8] !placeholder:text-[#87CEEB]"
                      buttonClass="!border !border-gray-300 !rounded-l-md !bg-gray-300"
                      dropdownClass="!bg-gray-300 !text-gray-800 !border !border-gray-300 !shadow-md"
                      disableCountryCode={false}
                      disableDropdown={false}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="office" className="text-white text-sm">
                        {t("order.office")} *
                      </Label>
                      <Input
                        id="office"
                        value={customerInfo.office}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            office: e.target.value,
                          })
                        }
                        placeholder="101"
                        className="bg-[#001F3F] border-[#00A8E8] text-white placeholder:text-[#87CEEB]"
                      />
                    </div>

                    <div>
                      <Label htmlFor="floor" className="text-white text-sm">
                        {t("order.floor")}
                      </Label>
                      <Input
                        id="floor"
                        value={customerInfo.floor}
                        onChange={(e) =>
                          setCustomerInfo({
                            ...customerInfo,
                            floor: e.target.value,
                          })
                        }
                        placeholder="1"
                        className="bg-[#001F3F] border-[#00A8E8] text-white placeholder:text-[#87CEEB]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="company" className="text-white text-sm">
                      {t("order.company")}
                    </Label>
                    <Input
                      id="company"
                      value={customerInfo.company}
                      onChange={(e) =>
                        setCustomerInfo({
                          ...customerInfo,
                          company: e.target.value,
                        })
                      }
                      placeholder="ТОО Компания"
                      className="bg-[#001F3F] border-[#00A8E8] text-white placeholder:text-[#87CEEB]"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#003D82] border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold text-white">
                    {t("order.paymentMethod")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value: "cash" | "invoice") => setPaymentMethod(value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cash" id="cash" className="border-[#00A8E8]" />
                      <Label htmlFor="cash" className="text-white text-sm">
                        {t("order.cashCard")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="invoice" id="invoice" className="border-[#00A8E8]" />
                      <Label htmlFor="invoice" className="text-white text-sm">
                        {t("order.invoice")}
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {orderDays.length > 0 && (
                <Card className="bg-[#003D82] border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl font-bold text-white">
                      <ShoppingCart className="h-5 w-5" />
                      {t("order.total")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {orderDays.map((orderDay) => {
                        const dishCount = orderDay.selectedDishes.length
                        const lunchTotal = calculateLunchLineTotal(orderDay)
                        const dessertQty = orderDay.dessertQuantity || 0
                        const dessertTotal = dessertQty * DESSERTS_PRICE

                        return (
                          <div key={orderDay.day} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-white text-sm">
                                {getDayName(orderDay.day)} ({Math.max(dishCount - 1, 0)}{" "}
                                {t("order.dishes")} × {orderDay.quantity})
                              </span>
                              <span className="text-white text-sm">{lunchTotal} ₸</span>
                            </div>
                            {dessertQty > 0 && (
                              <div className="flex justify-between text-[#87CEEB]">
                                <span className="text-xs">
                                  {t("order.dessert.title")} × {dessertQty}
                                </span>
                                <span className="text-xs">{dessertTotal} ₸</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div className="border-t pt-2 font-semibold flex justify-between">
                        <span className="text-white text-sm">{t("order.total")}:</span>
                        <span className="text-white text-sm">{calculateTotal()} ₸</span>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4 bg-[#00A8E8] hover:bg-[#0099CC] text-[#003D82] font-bold h-10"
                      onClick={submitOrder}
                      disabled={isMaintenanceMode}
                    >
                      {t("order.submit")}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="fixed right-0 top-32 w-64 h-64 opacity-20 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full text-[#003D82]">
          <path
            d="M 100 20 Q 150 50, 150 100 T 100 180"
            stroke="currentColor"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="150" cy="100" r="8" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}
