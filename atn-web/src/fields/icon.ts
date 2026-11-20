import type { Field } from 'payload'

export const iconOptions = [
  { label: 'Globo', value: 'globe' },
  { label: 'Persona', value: 'avatar' },
  { label: 'Candado', value: 'lock' },
  { label: 'Calendario', value: 'calendar' },
  { label: 'Usuarios', value: 'users' },
  { label: 'Reloj', value: 'clock' },
  { label: 'Libro', value: 'book' },
  { label: 'Ubicación', value: 'pin' },
  { label: 'Gráfica', value: 'chart' },
  { label: 'Estrella', value: 'star' },
  { label: 'Medalla', value: 'award' },
  { label: 'Corazón', value: 'heart' },
  { label: 'Moneda', value: 'money' },
  { label: 'Formulario', value: 'form' },
  { label: 'WhatsApp / mensaje', value: 'message' },
] as const

export type IconName = (typeof iconOptions)[number]['value']

export const iconField: Field = {
  name: 'icon',
  label: 'Ícono',
  type: 'select',
  defaultValue: 'globe',
  options: iconOptions as unknown as { label: string; value: string }[],
  admin: { width: '30%' },
}
