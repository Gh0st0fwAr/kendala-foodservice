import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { LanguageProvider } from "@/components/language-provider"
import { Toaster } from "@/components/ui/toaster"
import { OrdersProvider } from "@/components/orders-provider"
import { cookies } from "next/headers"
import { YandexMetrica } from "@/lib/metrics/yandexMetrics"
import { YandexRouterTracker } from "@/lib/metrics/YandexRouterTracker"
import Script from "next/script"

const inter = Inter({ subsets: ["latin", "cyrillic"] })

export const metadata: Metadata = {
  title: "KENDALA Foodservice by AZURE",
  description: "Food delivery service for Ken Dala Business Center",
  generator: "v0.dev",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const token = cookieStore.get("token")?.value || undefined
  const hash = cookieStore.get("hash")?.value || undefined

  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://ibronevik.ru" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://ibronevik.ru" />
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '730991276113875');
            fbq('track', 'PageView');
          `}
        </Script>

        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=730991276113875&ev=PageView&noscript=1"
          />
        </noscript>
      </head>

      <body className={inter.className}>
        <LanguageProvider>
          <OrdersProvider initialToken={token} initialHash={hash}>
            {children}
            <YandexMetrica />
            <YandexRouterTracker />
          </OrdersProvider>
          <Toaster />
        </LanguageProvider>
      </body>
    </html>
  )
}
