import type { SiteSetting } from '@/payload-types'
import { MediaLogo } from './MediaImage'
import { SmartLink } from './Button'
import { SocialIcon } from './Icon'

export function Footer({ settings }: { settings: SiteSetting }) {
  const social = (['facebook', 'linkedin', 'instagram'] as const).filter((k) => settings.social?.[k])
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div className="site-footer__brand">
            <p className="site-footer__name">{settings.siteName}</p>
            {social.length > 0 && (
              <ul className="site-footer__social" aria-label="Redes sociales">
                {social.map((k) => (
                  <li key={k}>
                    <a href={settings.social![k]!} target="_blank" rel="noopener noreferrer" aria-label={k}>
                      <SocialIcon name={k} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="site-footer__legal">
            {settings.footerLinks && settings.footerLinks.length > 0 && (
              <ul>
                {settings.footerLinks.map((l) => (
                  <li key={l.id ?? l.url}>
                    <SmartLink href={l.url}>{l.label}</SmartLink>
                  </li>
                ))}
              </ul>
            )}
            {settings.footerLogos && settings.footerLogos.length > 0 && (
              <ul className="site-footer__logos" aria-label="Entidades participantes">
                {settings.footerLogos.map((l) => {
                  const img = l.logo ? <MediaLogo media={l.logo} alt={l.name} sizes="160px" /> : <span>{l.name}</span>
                  return (
                    <li key={l.id ?? l.name}>
                      {l.url ? (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.name}>
                          {img}
                        </a>
                      ) : (
                        img
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <address className="site-footer__contact">
            {settings.contactTitle && <p>{settings.contactTitle}</p>}
            {settings.contactLinks?.map((c) =>
              c.url ? (
                <SmartLink key={c.id ?? c.label} href={c.url}>
                  {c.label}
                </SmartLink>
              ) : (
                <p key={c.id ?? c.label}>{c.label}</p>
              ),
            )}
          </address>
        </div>
      </div>
    </footer>
  )
}
