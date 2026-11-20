import Link from 'next/link'
import { isExternal } from '@/lib/media'

type Props = {
  href?: string | null
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  size?: 'md' | 'lg'
  className?: string
}

export function Button({ href, children, variant = 'primary', size = 'md', className = '' }: Props) {
  const cls = `btn btn--${variant} ${size === 'lg' ? 'btn--lg' : ''} ${className}`.trim()
  if (!href) return null
  if (isExternal(href)) {
    return (
      <a className={cls} href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    )
  }
  return (
    <Link className={cls} href={href}>
      {children}
    </Link>
  )
}

/** Enlace inteligente: interno con next/link, externo en nueva pestaña. */
export function SmartLink({
  href,
  children,
  className,
  ...rest
}: { href: string; children: React.ReactNode; className?: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (isExternal(href)) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    )
  }
  if (/^(mailto|tel):/.test(href) || href.startsWith('#')) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  )
}
