"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useOrders } from "@/components/orders-provider"
import {
  QR_MENU_DAYS,
  resolveQrMenuDay,
  withCacheBust,
  type QrMenuDayNum,
} from "@/lib/qr-menu"
import { Button } from "@/components/ui/button"

function preloadUrl(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = url
  })
}

export default function RestaurantQrMenuPage() {
  const { banner, isBannerVisible, isLoadingBanner, qrMenuImages } = useOrders()
  const resolved = useMemo(() => resolveQrMenuDay(), [])
  const [tab, setTab] = useState<QrMenuDayNum>(resolved.initialTab)

  const [afishaDismissed, setAfishaDismissed] = useState(false)
  const [bannerFetchDone, setBannerFetchDone] = useState(false)
  const bannerLoadStarted = useRef(false)
  const [afishaImgLoaded, setAfishaImgLoaded] = useState(false)
  const [dayImagesReady, setDayImagesReady] = useState(false)

  const bannerUrl = banner?.url
    ? withCacheBust(banner.url, banner.dlId || "banner")
    : null

  useEffect(() => {
    if (isLoadingBanner) {
      bannerLoadStarted.current = true
      return
    }
    if (bannerLoadStarted.current) setBannerFetchDone(true)
  }, [isLoadingBanner])

  // One-shot: preload afisha + all 5 day images in parallel after select
  useEffect(() => {
    if (isLoadingBanner) return

    const dayUrls = QR_MENU_DAYS.map((d) => qrMenuImages[d.day]?.url).filter(
      (u): u is string => Boolean(u),
    )

    if (!bannerUrl && dayUrls.length === 0) {
      setAfishaImgLoaded(false)
      setDayImagesReady(Object.keys(qrMenuImages).length > 0)
      return
    }

    let cancelled = false
    setAfishaImgLoaded(false)
    setDayImagesReady(false)

    const jobs: Promise<void>[] = dayUrls.map((url) => preloadUrl(url))
    if (bannerUrl) {
      jobs.push(
        preloadUrl(bannerUrl).then(() => {
          if (!cancelled) setAfishaImgLoaded(true)
        }),
      )
    } else {
      setAfishaImgLoaded(true)
    }

    void Promise.all(jobs).then(() => {
      if (!cancelled) setDayImagesReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [isLoadingBanner, bannerUrl, qrMenuImages])

  const closeAfisha = () => setAfishaDismissed(true)

  const showAfishaGate =
    !afishaDismissed && isBannerVisible && (!bannerFetchDone || !!bannerUrl)

  const current = qrMenuImages[tab]
  const showWeekendNotice = resolved.isWeekend && resolved.autoDay == null
  const menuLoading = isLoadingBanner || !dayImagesReady

  return (
    <div className="relative min-h-screen bg-[#001F3F] text-white">
      {showAfishaGate ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Афиша AZURE"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Закрыть афишу"
            onClick={closeAfisha}
          />

          <div className="relative z-[101] flex w-fit max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col rounded-lg bg-white p-4 shadow-xl">
            {bannerUrl && afishaImgLoaded ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerUrl}
                alt="Афиша AZURE"
                className="block h-auto max-h-[calc(100dvh-1.5rem-2rem-3.25rem)] w-auto max-w-[calc(100vw-1.5rem-2rem)] object-contain"
              />
            ) : (
              <p className="px-6 py-20 text-center text-sm text-gray-500">Загрузка афиши…</p>
            )}
            <div className="mt-3 shrink-0">
              <Button className="h-11 w-full" onClick={closeAfisha}>
                К меню
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Keep all day images in DOM (hidden) so browser cache is warm */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
        {QR_MENU_DAYS.map((d) => {
          const img = qrMenuImages[d.day]
          if (!img?.url) return null
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`preload-${d.day}-${img.dlId}`} src={img.url} alt="" />
          )
        })}
      </div>

      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-3 pb-6 pt-4">
        <header className="mb-3 text-center">
          <h1 className="text-lg font-semibold tracking-wide">AZURE · обеденное меню</h1>
          <p className="text-xs text-[#87CEEB]">QR · без заказа · покажите официанту</p>
        </header>

        {showWeekendNotice && (
          <div className="mb-3 rounded-md border border-yellow-600/50 bg-yellow-900/30 px-3 py-2 text-sm text-yellow-100">
            Обеденное меню AZURE доступно с понедельника по пятницу. Ниже можно посмотреть дни
            текущей недели, если картинки уже загружены.
          </div>
        )}

        <nav className="mb-3 flex gap-1" aria-label="Дни недели">
          {QR_MENU_DAYS.map((d) => {
            const active = tab === d.day
            const isToday = resolved.autoDay === d.day
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => setTab(d.day)}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#00A8E8] text-[#003D82]"
                    : "bg-[#003366] text-[#87CEEB] hover:bg-[#004080]"
                } ${isToday ? "ring-2 ring-orange-400 ring-offset-1 ring-offset-[#001F3F]" : ""}`}
              >
                {d.label}
                {isToday ? (
                  <span className="mt-0.5 block text-[10px] font-normal opacity-80">сегодня</span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="flex flex-1 flex-col items-center justify-start">
          {menuLoading ? (
            <p className="text-sm text-[#87CEEB]">Загрузка меню на неделю…</p>
          ) : current?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${tab}-${current.dlId}`}
              src={current.url}
              alt={`Меню ${QR_MENU_DAYS.find((d) => d.day === tab)?.label}`}
              className="w-full max-w-full rounded-md object-contain"
            />
          ) : (
            <p className="text-sm text-[#87CEEB]">
              Картинка меню на этот день ещё не загружена в админке.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Button asChild className="w-full bg-[#00A8E8] font-bold text-[#003D82] hover:bg-[#0099CC]">
            <Link
              href={`/?day=${QR_MENU_DAYS.find((d) => d.day === tab)?.orderDay ?? "monday"}`}
            >
              Заказать с доставкой
            </Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
