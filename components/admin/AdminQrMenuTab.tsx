"use client"

import { useCallback, useEffect, useState } from "react"
import { Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { dropboxApi } from "@/lib/api"
import { useOrders } from "@/components/orders-provider"
import {
  QR_MENU_DAYS,
  dropboxFilePublicUrl,
  matchQrMenuDayFromFileName,
  qrMenuFileBaseName,
  withCacheBust,
  type QrMenuDayNum,
} from "@/lib/qr-menu"
import { useToast } from "@/hooks/use-toast"

type DaySlot = {
  day: QrMenuDayNum
  label: string
  url: string | null
  dlId: string | null
  ext: string | null
  file: File | null
  uploading: boolean
}

type DropboxEntry = {
  dl_id?: string
  json?: { name?: string; name_upload?: string }
}

function emptySlots(): DaySlot[] {
  return QR_MENU_DAYS.map((d) => ({
    day: d.day,
    label: d.label,
    url: null,
    dlId: null,
    ext: null,
    file: null,
    uploading: false,
  }))
}

function entryName(entry: DropboxEntry): string {
  return entry.json?.name || entry.json?.name_upload || ""
}

function fileExt(name: string): string {
  const parts = name.split(".")
  return parts.length > 1 ? (parts.pop() || "").toLowerCase() : ""
}

/** Prefer jpg/png/webp over leftover svg mocks; then higher dl_id */
function pickBestEntry(entries: DropboxEntry[]): DropboxEntry | null {
  if (!entries.length) return null
  const score = (e: DropboxEntry) => {
    const ext = fileExt(entryName(e))
    const raster = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? 1000 : 0
    const id = Number(e.dl_id) || 0
    return raster + id
  }
  return [...entries].sort((a, b) => score(b) - score(a))[0] || null
}

function apiErrorText(res: { error?: unknown; data?: { message?: string } }): string {
  if (typeof res.error === "string" && res.error.trim()) return res.error
  if (res.data?.message) return res.data.message
  return "Не удалось загрузить"
}

export function AdminQrMenuTab() {
  const { toast } = useToast()
  const { token, hash, loadBanner } = useOrders()
  const [slots, setSlots] = useState<DaySlot[]>(emptySlots)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await dropboxApi.getFiles({ private: "-1" })
      const filesMap =
        res.success &&
        (res.data?.data?.["dropbox files"] ?? res.data?.["dropbox files"])
      const next = emptySlots()
      const byDay: Partial<Record<QrMenuDayNum, DropboxEntry[]>> = {}

      if (filesMap && typeof filesMap === "object") {
        for (const entry of Object.values(filesMap) as DropboxEntry[]) {
          const day = matchQrMenuDayFromFileName(entryName(entry))
          if (!day || !entry.dl_id) continue
          if (!byDay[day]) byDay[day] = []
          byDay[day]!.push(entry)
        }
      }

      for (const d of QR_MENU_DAYS) {
        const best = pickBestEntry(byDay[d.day] || [])
        if (!best?.dl_id) continue
        const idx = next.findIndex((s) => s.day === d.day)
        if (idx < 0) continue
        const name = entryName(best)
        next[idx] = {
          ...next[idx],
          dlId: String(best.dl_id),
          ext: fileExt(name) || null,
          url: withCacheBust(dropboxFilePublicUrl(String(best.dl_id)), String(best.dl_id)),
        }
      }
      setSlots(next)
    } catch (e) {
      console.error(e)
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить QR-меню",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

  const setFile = (day: QrMenuDayNum, file: File | null) => {
    setSlots((prev) => prev.map((s) => (s.day === day ? { ...s, file } : s)))
  }

  const uploadDay = async (day: QrMenuDayNum) => {
    const slot = slots.find((s) => s.day === day)
    if (!slot?.file) {
      toast({ title: "Ошибка", description: "Выберите изображение", variant: "destructive" })
      return
    }
    if (!slot.file.type.startsWith("image/")) {
      toast({ title: "Ошибка", description: "Только изображения", variant: "destructive" })
      return
    }
    if (!token || !hash) {
      toast({
        title: "Ошибка",
        description: "Нет сессии админа (token). Выйдите и войдите снова.",
        variant: "destructive",
      })
      return
    }

    setSlots((prev) => prev.map((s) => (s.day === day ? { ...s, uploading: true } : s)))
    try {
      const base64 = await fileToBase64(slot.file)
      const ext = slot.file.name.split(".").pop()?.toLowerCase() || "jpg"
      const rasterExts = ["jpg", "jpeg", "png", "webp", "gif"]
      // Don't "replace" old SVG mocks with JPEG bytes under .svg dl_id — create proper file
      const canReplace =
        Boolean(slot.dlId) &&
        Boolean(slot.ext) &&
        rasterExts.includes(slot.ext!) &&
        (slot.ext === ext || (slot.ext === "jpeg" && ext === "jpg") || (slot.ext === "jpg" && ext === "jpeg"))

      const filePayload = canReplace
        ? JSON.stringify({ dl_id: slot.dlId, base64 })
        : JSON.stringify({
            base64,
            name: `${qrMenuFileBaseName(day)}.${ext}`,
            private: -1,
          })

      const res = await dropboxApi.uploadFile({
        file: filePayload,
        token,
        u_hash: hash,
      })

      if (res.success) {
        toast({
          title: "Успешно",
          description: canReplace
            ? `Меню ${slot.label} обновлено`
            : `Меню ${slot.label} загружено (новый файл)`,
        })
        await refresh()
        await loadBanner()
      } else {
        toast({
          title: "Ошибка",
          description: apiErrorText(res),
          variant: "destructive",
        })
      }
    } catch (e) {
      console.error(e)
      toast({ title: "Ошибка", description: "Сбой загрузки", variant: "destructive" })
    } finally {
      setSlots((prev) =>
        prev.map((s) => (s.day === day ? { ...s, uploading: false, file: null } : s)),
      )
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900">Меню в ресторане / QR</h2>
        <p className="mt-1 text-sm text-gray-600">
          Пять вертикальных картинок Пн–Пт для{" "}
          <code className="rounded bg-gray-100 px-1">/menu</code>. Афиша — в «Настройки». Имена:{" "}
          <code className="rounded bg-gray-100 px-1">menu-azure-1.jpg</code> …{" "}
          <code className="rounded bg-gray-100 px-1">menu-azure-5.jpg</code>. Лучше JPG/PNG (не SVG).
        </p>
        {!token || !hash ? (
          <p className="mt-2 text-sm text-red-600">
            Сессия без token/hash — загрузка на бэкенд не пройдёт. Перелогиньтесь в админку.
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Загрузка превью…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <Card key={slot.day}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {slot.label} · день {slot.day}
                  {slot.ext ? (
                    <span className="ml-2 text-xs font-normal text-gray-500">.{slot.ext}</span>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex h-56 items-center justify-center overflow-hidden rounded-lg border bg-gray-50 p-2">
                  {slot.url && !slot.uploading ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={slot.url}
                      alt={`QR ${slot.label}`}
                      className="max-h-56 w-auto max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm text-gray-500">
                      {slot.uploading ? "Загрузка…" : "Нет фото"}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`qr-${slot.day}`}>Загрузить / заменить</Label>
                  <Input
                    id={`qr-${slot.day}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={(e) => setFile(slot.day, e.target.files?.[0] ?? null)}
                  />
                  <Button
                    className="flex w-full items-center gap-2"
                    onClick={() => void uploadDay(slot.day)}
                    disabled={slot.uploading || !slot.file || !token || !hash}
                  >
                    <Upload className="h-4 w-4" />
                    {slot.uploading ? "Загрузка…" : "Сохранить"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={() => void refresh()}>
        Обновить превью
      </Button>
    </div>
  )
}
