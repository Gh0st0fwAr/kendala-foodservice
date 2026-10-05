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

const PRELOAD_TIMEOUT_MS = 12_000

function preloadUrl(url: string, timeoutMs = PRELOAD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    const timer = window.setTimeout(finish, timeoutMs)
    img.onload = () => {
      window.clearTimeout(timer)
      finish()
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      finish()
    }
    img.src = url
  })
}

export default function RestaurantQrMenuPage() {
  const {
    banner,
    isBannerVisible,
    bannerStatusKnown,
    isLoadingBanner,
    qrMenuImages,
  } = useOrders()
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

  const dayImageVersion = useMemo(
    () =>
      QR_MENU_DAYS.map((d) => {
        const img = qrMenuImages[d.day]
        return img ? `${d.day}:${img.dlId}:${img.url}` : `${d.day}:`
      }).join("|"),
    [qrMenuImages],
  )

  useEffect(() => {
    if (isLoadingBanner) {
      bannerLoadStarted.current = true
      return
    }
    if (bannerLoadStarted.current) setBannerFetchDone(true)
  }, [isLoadingBanner])

  // Afisha blocks the screen — never starve it behind five heavy day images.
  const afishaNeedsBanner =
    bannerStatusKnown && isBannerVisible && !afishaDismissed && !!bannerUrl && !afishaImgLoaded

  // Preload all five day images only after afisha no longer needs the network,
  // or when afisha is off / dismissed / missing.
  useEffect(() => {
    if (isLoadingBanner) return
    if (!bannerStatusKnown) return
    if (afishaNeedsBanner) return

    const dayUrls = QR_MENU_DAYS.map((d) => {
      const img = qrMenuImages[d.day]
      return img?.url ? withCacheBust(img.url, img.dlId) : null
    }).filter((u): u is string => Boolean(u))

    let cancelled = false
    setDayImagesReady(false)

    if (dayUrls.length === 0) {
      setDayImagesReady(true)
      return
    }

    void Promise.all(dayUrls.map((url) => preloadUrl(url))).then(() => {
      if (!cancelled) setDayImagesReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [
    isLoadingBanner,
    bannerStatusKnown,
    afishaNeedsBanner,
    dayImageVersion,
    qrMenuImages,
  ])

  // Soft timeout: don't leave "Загрузка афиши…" forever if the proxy is slow
  useEffect(() => {
    if (!bannerUrl || afishaImgLoaded) return
    const timer = window.setTimeout(() => setAfishaImgLoaded(true), PRELOAD_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [bannerUrl, afishaImgLoaded])

  // No file after fetch: don't spin forever when visibility flag is on
  useEffect(() => {
    if (!bannerFetchDone) return
    if (!bannerUrl) setAfishaImgLoaded(true)
  }, [bannerFetchDone, bannerUrl])

  const closeAfisha = () => setAfishaDismissed(true)

  const showAfishaGate =
    bannerStatusKnown &&
    !afishaDismissed &&
    isBannerVisible &&
    (!bannerFetchDone || !!bannerUrl)

  const current = qrMenuImages[tab]
  const currentUrl = current?.url
    ? withCacheBust(current.url, current.dlId)
    : null
  const showWeekendNotice = resolved.isWeekend && resolved.autoDay == null
  // While afisha is up, don't block the page behind on day preloads —
  // days warm up after user closes afisha (or banner finishes).
  const menuLoading =
    isLoadingBanner || (!afishaNeedsBanner && !dayImagesReady && !showAfishaGate)

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
            {bannerUrl ? (
              <>
                {!afishaImgLoaded ? (
                  <p className="px-6 py-20 text-center text-sm text-gray-500">Загрузка афиши…</p>
                ) : null}
                {/* Visible img starts download immediately — highest priority vs day preloads */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={bannerUrl}
                  alt="Афиша AZURE"
                  onLoad={() => setAfishaImgLoaded(true)}
                  onError={() => setAfishaImgLoaded(true)}
                  className={`block h-auto max-h-[calc(100dvh-1.5rem-2rem-3.25rem)] w-auto max-w-[calc(100vw-1.5rem-2rem)] object-contain ${
                    afishaImgLoaded ? "" : "hidden"
                  }`}
                />
              </>
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

      {/* Keep day images in DOM after afisha releases bandwidth */}
      {!afishaNeedsBanner ? (
        <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
          {QR_MENU_DAYS.map((d) => {
            const img = qrMenuImages[d.day]
            if (!img?.url) return null
            const src = withCacheBust(img.url, img.dlId)
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`preload-${d.day}-${img.dlId}`} src={src} alt="" />
            )
          })}
        </div>
      ) : null}

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
          ) : currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${tab}-${current?.dlId}`}
              src={currentUrl}
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
