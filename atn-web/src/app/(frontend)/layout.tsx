import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { JsonLd } from '@/components/JsonLd'
import { WhatsAppButton } from '@/components/WhatsAppButton'
import { absolute, asMedia, mediaUrl, siteUrl } from '@/lib/media'
import { getProgramas, getSettings } from '@/lib/payload'
import './styles.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap', variable: '--font-inter' })

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings()
  const base = siteUrl(s.siteUrl)
  return {
    metadataBase: new URL(base),
    title: { default: s.defaultTitle || s.siteName, template: `%s | ${s.siteName}` },
    description: s.defaultDescription || undefined,
    applicationName: s.siteName,
    formatDetection: { telephone: false },
    verification: s.googleVerification ? { google: s.googleVerification } : undefined,
  }
}

export const viewport: Viewport = { themeColor: '#ffffff', width: 'device-width', initialScale: 1 }

const logoProps = (m: unknown) => {
  const media = asMedia(m as never)
  return media?.url
    ? { url: media.url, alt: media.alt, width: media.width ?? 200, height: media.height ?? 60 }
    : null
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [settings, programas] = await Promise.all([getSettings(), getProgramas()])
  const base = siteUrl(settings.siteUrl)
  const social = Object.values(settings.social ?? {}).filter((v): v is string => typeof v === 'string' && !!v)

  return (
    <html lang="es-MX" className={inter.variable}>
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        <Header
          siteName={settings.siteName}
          logo={logoProps(settings.logo)}
          logoLight={logoProps(settings.logoLight)}
          nav={(settings.nav ?? []).map((n) => ({ label: n.label, url: n.url }))}
          overlayPaths={programas.docs.map((p) => `/${p.slug}`)}
        />
        <main id="contenido">{children}</main>
        <Footer settings={settings} />
        <WhatsAppButton number={settings.whatsapp?.number} message={settings.whatsapp?.message} />
        <JsonLd
          data={[
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: settings.siteName,
              url: base,
              logo: absolute(base, mediaUrl(settings.logo)),
              sameAs: social.length ? social : undefined,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: settings.siteName,
              url: base,
              inLanguage: 'es-MX',
            },
          ]}
        />
        {settings.gaId && /^G-[A-Z0-9]+$/i.test(settings.gaId) && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${settings.gaId}`} strategy="afterInteractive" />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${settings.gaId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}
