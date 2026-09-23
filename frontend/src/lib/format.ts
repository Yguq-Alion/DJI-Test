const LOCALE = 'ru-RU'

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const moneyCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'RUB',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 })
const signedDecimal = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })

export const DASH = '—'

export function formatMoney(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : money.format(value)
}

/** «252,4 млн ₽» — для плиток и осей; точное значение показывается в подсказке. */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH
  return Math.abs(value) < 100_000 ? money.format(value) : moneyCompact.format(value)
}

export function formatInteger(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : integer.format(value)
}

/** Доля 0..1 → «18,5 %». */
export function formatShare(value: number | null | undefined): string {
  return value === null || value === undefined ? DASH : percent.format(value)
}

/** Изменение к прошлому периоду: «+12,3 %» или «−0,5 п.п.». */
export function formatChange(value: number | null, kind: 'percent' | 'points'): string {
  if (value === null) return DASH
  return `${signedDecimal.format(value)}${kind === 'points' ? ' п.п.' : ' %'}`
}

const dateShort = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' })
const dateLong = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

/** ISO-дата «2026-09-01» без сдвига часового пояса. */
export function parseIsoDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatDateRange(from: string, to: string): string {
  if (from === to) return dateLong.format(parseIsoDate(from))
  return `${dateShort.format(parseIsoDate(from))} – ${dateLong.format(parseIsoDate(to))}`
}

/** Момент (UTC ISO) в локальном времени браузера. */
export function formatDateTime(isoInstant: string): string {
  return dateTime.format(new Date(isoInstant))
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
