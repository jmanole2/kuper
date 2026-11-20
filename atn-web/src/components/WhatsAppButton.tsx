import { WhatsAppIcon } from './Icon'

export function WhatsAppButton({ number, message }: { number?: string | null; message?: string | null }) {
  const n = number?.replace(/\D/g, '')
  if (!n) return null
  const href = `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ''}`
  return (
    <a className="whatsapp-fab" href={href} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp">
      <WhatsAppIcon />
    </a>
  )
}
