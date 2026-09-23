import { parseAsStringLiteral, useQueryState } from 'nuqs'
import type { Granularity } from '@/api/types'

export const GRANULARITY_OPTIONS = [
  { value: 'auto', label: 'Авто' },
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
] as const

export function useGranularity() {
  return useQueryState(
    'step',
    parseAsStringLiteral(GRANULARITY_OPTIONS.map((o) => o.value))
      .withDefault('auto')
      .withOptions({ history: 'replace' }),
  )
}

const hour = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const day = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const month = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: '2-digit' })
const monthLong = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })
const dayLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })

/** bucketStart приходит как локальное время пояса пользователя без смещения — парсим как локальное. */
export function parseBucket(value: string): Date {
  return new Date(value)
}

export function formatBucketTick(value: string, granularity: Granularity): string {
  const date = parseBucket(value)
  switch (granularity) {
    case 'hour':
      return hour.format(date)
    case 'month':
      return month.format(date)
    default:
      return day.format(date)
  }
}

export function formatBucketTitle(value: string, granularity: Granularity): string {
  const date = parseBucket(value)
  switch (granularity) {
    case 'hour':
      return `${dayLong.format(date)}, ${hour.format(date)}`
    case 'week': {
      const end = new Date(date)
      end.setDate(end.getDate() + 6)
      return `Неделя ${day.format(date)} – ${day.format(end)}`
    }
    case 'month':
      return monthLong.format(date)
    default:
      return dayLong.format(date)
  }
}
