"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { useLanguage } from "@/components/language-provider"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { authApi, commonApi, dropboxApi, menuApi, ordersApi } from "@/lib/api"
import * as XLSX from "xlsx"
import { useOrders } from "@/components/orders-provider"
import { BANNER, TEST_INDEX } from "@/lib/constants"
import { parseMenuExcelRows } from "@/lib/menu-excel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "@/components/ui/calendar"
import {
  AdminAuthCard,
  type LoginMethod,
  type LoginType,
  type LoginData,
  type RegistrationData,
} from "@/components/admin/AdminAuthCard"
import { AdminMenuTab } from "@/components/admin/AdminMenuTab"
import { AdminOrdersTab } from "@/components/admin/AdminOrdersTab"
import { AdminQrMenuTab } from "@/components/admin/AdminQrMenuTab"
import { AdminSettingsTab } from "@/components/admin/AdminSettingsTab"

interface BaseStyles {
  default: string
  secondary: string
  outline: string
}

export default function AdminPage() {
  const { t } = useLanguage()
  const {
    orders,
    token,
    setToken,
    hash,
    setHash,
    getOrders,
    isMaintenanceMode,
    setIsMaintenanceMode,
    isBannerVisible,
    setIsBannerVisible,
    banner,
    setBanner
  } = useOrders()
  const { toast } = useToast()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginData, setLoginData] = useState<LoginData>({ login: "", password: "" })
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isRegistering, setIsRegistering] = useState(false)
  const [showCodeField, setShowCodeField] = useState(false)
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    name: "",
    login: "",
    password: "",
    method: "telegram",
    code: "",
  })
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("e-mail")
  const [loginType, setLoginType] = useState<LoginType>()
  const [dishes, setDishes] = useState<string>()
  const [openOrderId, setOpenOrderId] = useState<string | null>(null)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [period, setPeriod] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({
    from: new Date(),
    to: new Date(),
  })
  const [isLoadingExport, setIsLoadingExport] = useState(false)
  const [activeTab, setActiveTab] = useState("menu")
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)

  const normalizePhone = (val: string) => val.replace(/[^\d]/g, "") // только цифры

  const isPhone = (val: string) => {
    const digits = normalizePhone(val)
    return digits.length >= 10 && digits.length <= 15
  }

  // 🚦 улучшенный детектор логина
  const detectLogin = (value: string) => {
    const emailRe = /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i

    if (isPhone(value)) return { type: "phone" as const, method: "telegram_id" as const }
    if (emailRe.test(value.trim())) return { type: "email" as const, method: "e-mail" as const }

    return { type: undefined, method: "e-mail" as const }
  }

  useEffect(() => {
    const { type, method } = detectLogin(loginData.login) // авторизация
    const { type: rType, method: rMethod } = detectLogin(registrationData.login) // регистрация

    setLoginType(type ?? rType) // для поля «входа» важнее
    setLoginMethod(method ?? rMethod) // для поля «регистрации» важнее

    // если оба поля пусты → сброс
    if (!loginData.login && !registrationData.login) {
      setLoginType(undefined)
      setLoginMethod("e-mail")
    }
  }, [loginData.login, registrationData.login])

  useEffect(() => {
    if (token && hash) {
      setIsLoggedIn(true)
    }
  }, [token, hash])

  useEffect(() => {
    const storedTab = localStorage.getItem("admin_active_tab")
    if (
      storedTab === "menu" ||
      storedTab === "orders" ||
      storedTab === "settings" ||
      storedTab === "qr"
    ) {
      setActiveTab(storedTab)
    }
  }, [])

  const handleToggleMaintenance = async (switchValue: boolean) => {
    const siteOnline = {
      site_constants: [{ id: "site_online", value: switchValue ? 1 : 0 }],
    }

    try {
      const res = await commonApi.setSiteStatus({
        data: JSON.stringify(siteOnline),
        token: token,
        u_hash: hash,
      })

      if (res.success) {
        setIsMaintenanceMode(switchValue)

        toast({
          title: t("common.success"),
          description: `Технические работы ${switchValue ? "начаты" : "завершены"}`,
        })
      } else {
        toast({
          title: t("common.error"),
          description: res.error || "Не удалось изменить состояние сайта",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: t("common.error"),
        description: "Ошибка при изменении состояния сайта",
        variant: "destructive",
      })
    }
  }

  const handleToggleBannerVisible = async (switchValue: boolean) => {
    const bannerVisible = {
      lang_vls: {
        banner: {
          1: JSON.stringify({ id: "banner_visible", value: switchValue ? 1 : 0 }),
        },
      },
    }

    try {
      const res = await commonApi.setBannerStatus({
        data: JSON.stringify(bannerVisible),
        token: token,
        u_hash: hash,
      })

      if (res.success) {
        setIsBannerVisible(switchValue)

        toast({
          title: t("common.success"),
          description: `Баннер ${switchValue ? "включён" : "выключен"}`,
        })
      } else {
        toast({
          title: t("common.error"),
          description: res.error || "Не удалось изменить состояние баннера",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: t("common.error"),
        description: "Ошибка при изменении состояния баннера",
        variant: "destructive",
      })
    }
  }

  const handleLogin = async () => {
    if (!loginData.password) {
      toast({
        title: t("common.error"),
        description: "Укажите пароль",
        variant: "destructive",
      })
    } else {
      const resAuth = await authApi.login({
        login: loginData.login,
        password: loginData.password,
        type: !loginMethod ? "e-mail" : loginMethod,
      })

      if (resAuth.success && resAuth.data?.auth_hash) {
        const resToken = await authApi.token({
          auth_hash: resAuth.data.auth_hash,
        })
        setToken(resToken.data?.data.token)
        setHash(resToken.data?.data.u_hash)
        setIsLoggedIn(true)
        window.location.href = "/admin"
        toast({ title: t("common.success"), description: "Вход успешен" })
      } else {
        toast({
          title: t("common.error"),
          description: resAuth.error || "Неверный пароль",
          variant: "destructive",
        })
      }
    }
    return
  }

  const handleRegister = async () => {
    // 1. Проверяем, что логин валиден
    const { type } = detectLogin(registrationData.login) // helper выше
    if (!type) {
      toast({
        title: t("common.error"),
        description: "Некорректный логин – введите телефон или e-mail",
        variant: "destructive",
      })
      return // дальше не идём
    }

    // отправляем запрос на получение кода
    const res = await authApi.register({
      u_name: registrationData.name,
      u_phone: loginType !== "email" ? registrationData.login : undefined,
      u_email: loginType === "email" ? registrationData.login : undefined,
      u_tg:
        loginType !== "email" && registrationData.method === "telegram"
          ? registrationData.code
          : undefined,
      u_wa:
        loginType !== "email" && registrationData.method === "whatsapp"
          ? registrationData.login
          : undefined,
      u_role: 2,
      st: registrationData.password ? "true" : undefined,
      data: JSON.stringify({
        password: registrationData.password,
      }),
    })

    if (res.success) {
      if (registrationData.password) {
        toast({
          title: t("common.success"),
          description: "Регистрация успешна",
        })
        setIsLoggedIn(true)
        window.location.href = "/admin"
      } else {
        toast({
          title: t("common.success"),
          description: "Пароль отправлен на ваш контакт",
        })
      }
    } else {
      toast({
        title: t("common.error"),
        description: res.error || "Unknown error",
        variant: "destructive",
      })
    }
  }

  const handleLogout = async () => {
    const res = await authApi.logout()
    if (res.success) {
      setIsLoggedIn(false)
      setToken(undefined)
      setHash(undefined)
      toast({ title: t("common.success"), description: "Выход выполнен" })
    } else {
      toast({
        title: t("common.error"),
        description: res.error || "Не удалось выйти",
        variant: "destructive",
      })
    }
    return
  }

  const handleMenuShoose = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file && file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      try {
        // Читаем файл как ArrayBuffer
        const data = await file.arrayBuffer()

        // Парсим Excel
        const workbook = XLSX.read(data, { type: "array" })

        // Берём первый лист
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]

        // Конвертируем в JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet)
        const parsed = parseMenuExcelRows(jsonData as unknown[])
        if (!parsed.ok) {
          toast({
            title: t("common.error"),
            description: parsed.errors[0] || "Ошибка структуры Excel",
            variant: "destructive",
          })
          return
        }
        if (parsed.warnings.length) {
          toast({
            title: "Проверьте Excel",
            description: parsed.warnings.slice(0, 2).join(" · "),
          })
        }

        const dataDishes = {
          lang_vls: {
            dishes: {
              [TEST_INDEX]: JSON.stringify(parsed.dishes),
            },
          },
        }

        setDishes(JSON.stringify(dataDishes))
      } catch (error) {
        console.error(error)
        toast({
          title: t("common.error"),
          description: "Ошибка при обработке файла",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: t("common.error"),
        description: "Пожалуйста, выберите файл Excel (.xlsx)",
        variant: "destructive",
      })
    }
  }

  const handleMenuUpload = async () => {
    if (dishes) {
      try {
        const res = await menuApi.uploadMenu({
          data: dishes,
          token: token,
          u_hash: hash,
        })

        if (res.success) {
          toast({
            title: t("common.success"),
            description: "Меню успешно загружено",
          })
        } else {
          toast({
            title: t("common.error"),
            description: res.error || "Не удалось загрузить меню",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error(error)
        toast({
          title: t("common.error"),
          description: "Ошибка при обработке файла",
          variant: "destructive",
        })
      }
    } else {
      toast({
        title: t("common.error"),
        description: "Пожалуйста, выберите файл Excel (.xlsx)",
        variant: "destructive",
      })
    }
  }

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await ordersApi.updateOrderStatus(orderId, newStatus)
      toast({
        title: t("common.success"),
        description: "Статус заказа успешно обновлен",
      })
      await getOrders()
    } catch (error) {}
  }

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        resolve(reader.result as string)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const handleBannerUpload = async () => {
    if (!bannerFile) {
      toast({
        title: t("common.error"),
        description: "Пожалуйста, выберите изображение",
        variant: "destructive",
      })
      return
    }

    if (!bannerFile.type.startsWith("image/")) {
      toast({
        title: t("common.error"),
        description: "Поддерживаются только изображения",
        variant: "destructive",
      })
      return
    }

    try {
      setIsUploadingBanner(true)
      const base64 = await fileToBase64(bannerFile)
      const filePayload = banner?.dlId
        ? JSON.stringify({
            dl_id: banner.dlId,
            base64,
          })
        : JSON.stringify({
            base64,
            name: `${BANNER}.${bannerFile.name.split(".").pop()?.toLowerCase() || "png"}`,
            private: -1,
          })

      const res = await dropboxApi.uploadFile({
        file: filePayload,
        token: token,
        u_hash: hash,
      })

      if (res.success) {
        toast({
          title: t("common.success"),
          description: "Баннер успешно загружен",
        })
        
        const dlId = res.data.data.dl_id
        setBannerFile(null)
        setBanner({
          url: `https://ibronevik.ru/taxi/api/v1/dropbox/file/${dlId}`,
          dlId: dlId,
        })
      } else {
        toast({
          title: t("common.error"),
          description:
            typeof res.error === "string" && res.error.trim()
              ? res.error
              : "Не удалось загрузить баннер",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: t("common.error"),
        description: "Ошибка при загрузке баннера",
        variant: "destructive",
      })
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const handleToggle = (orderId: string) => {
    setOpenOrderId((prev) => (prev === orderId ? null : orderId))
  }

  const statusMap = {
    new: { label: "Новый", variant: "default" as const },
    accepted: { label: "Принят", variant: "secondary" as const },
    paid: { label: "Оплачен", variant: "outline" as const },
    delivered: { label: "Доставлен", variant: "default" as const },
  }
  const getStatusBadge = (status: string) => {
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.new
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const getVariantStyle = (variant: string, isSelected: boolean) => {
    if (isSelected) {
      return "bg-blue-50 text-blue-600 font-medium"
    }

    const baseStyles: BaseStyles = {
      default: "hover:bg-gray-50",
      secondary: "hover:bg-gray-50 text-gray-700",
      outline: "hover:bg-gray-50 border border-gray-200",
    }

    return baseStyles[variant as keyof BaseStyles] || baseStyles.default
  }

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer.phone.includes(searchTerm) ||
      order.customer.office.includes(searchTerm)
    const matchesStatus = statusFilter === "all" || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const exportToExcel = async () => {
    if (!period.from || !period.to) {
      toast({
        title: t("common.error"),
        description: "Выберите период",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoadingExport(true)

      const blob = await ordersApi.exportOrders({
        token: token,
        u_hash: hash,
        is_var: 1,
        s_t_data: {
          date_from: period.from.toISOString(),
          date_to: period.to.toISOString(),
        },
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "export.xlsx"
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast({ title: t("common.success"), description: "Отчёт сформирован" })
      setIsExportOpen(false)
    } catch (err: any) {
      toast({
        title: t("common.error"),
        description: err.message || "Не удалось сформировать отчёт",
        variant: "destructive",
      })
    } finally {
      setIsLoadingExport(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <AdminAuthCard
              isRegistering={isRegistering}
              showCodeField={showCodeField}
              loginData={loginData}
              registrationData={registrationData}
              loginType={loginType}
              loginMethod={loginMethod}
              setLoginData={setLoginData}
              setRegistrationData={setRegistrationData}
              setIsRegistering={setIsRegistering}
              setShowCodeField={setShowCodeField}
              setLoginMethod={setLoginMethod}
              onLogin={handleLogin}
              onRegister={handleRegister}
              t={t}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("admin.title")}</h1>
          </div>
          <Button variant="outline" onClick={() => handleLogout()}>
            {t("admin.logout")}
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value)
            localStorage.setItem("admin_active_tab", value)
            if (value === "orders") {
              void getOrders()
            }
          }}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="menu">{t("admin.uploadMenu")}</TabsTrigger>
            <TabsTrigger value="orders">{t("admin.orders")}</TabsTrigger>
            <TabsTrigger value="qr">QR-меню</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="menu">
            <AdminMenuTab onMenuFileChange={handleMenuShoose} onMenuUpload={handleMenuUpload} />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersTab
              filteredOrders={filteredOrders}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              openOrderId={openOrderId}
              statusMap={statusMap}
              onSearchTermChange={setSearchTerm}
              onStatusFilterChange={setStatusFilter}
              onToggleOrder={handleToggle}
              onStatusChange={handleStatusChange}
              getStatusBadge={getStatusBadge}
              getVariantStyle={getVariantStyle}
              onExportOpen={() => setIsExportOpen(true)}
            />
          </TabsContent>
          <TabsContent value="qr">
            <AdminQrMenuTab />
          </TabsContent>
          <TabsContent value="settings">
            <AdminSettingsTab
              isMaintenanceMode={isMaintenanceMode}
              isBannerVisible={isBannerVisible}
              isUploadingBanner={isUploadingBanner}
              onToggleMaintenance={handleToggleMaintenance}
              onToggleBannerVisible={handleToggleBannerVisible}
              onBannerFileChange={setBannerFile}
              onBannerUpload={handleBannerUpload}
            />
          </TabsContent>
          <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
            <DialogContent className="space-y-4 w-auto max-w-none">
              <DialogHeader>
                <DialogTitle>Экспорт отчёта</DialogTitle>
                <DialogDescription>Выберите период и скачайте Excel-отчёт</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4">
                <Label>Период</Label>
                <Calendar
                  mode="range"
                  selected={period}
                  onSelect={(v) => setPeriod({ from: v?.from, to: v?.to })}
                  numberOfMonths={1}
                />
              </div>

              <Button
                onClick={exportToExcel}
                disabled={isLoadingExport || !period.from || !period.to}
                className="w-full"
              >
                {isLoadingExport ? "Формируем..." : "Скачать отчёт"}
              </Button>
            </DialogContent>
          </Dialog>
        </Tabs>
      </div>
    </div>
  )
}
