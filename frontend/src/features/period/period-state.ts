import { parseAsIsoDate, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useMemo } from 'react'
import { toIsoDate } from '@/lib/format'

export const PRESETS = [
  { value: 'today', label: 'Сегодня' },
  { value: '7d', label: '7 дней' },
  { value: '30d', label: '30 дней' },
  { value: 'thisMonth', label: 'Этот месяц' },
  { value: 'lastMonth', label: 'Прошлый месяц' },
] as const

export type Preset = (typeof PRESETS)[number]['value']
export const DEFAULT_PRESET: Preset = '30d'

/** Пояс браузера: границы периодов на сервере считаются в нём. */
export const USER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const periodParsers = {
  preset: parseAsStringLiteral(PRESETS.map((p) => p.value)),
  from: parseAsIsoDate,
  to: parseAsIsoDate,
}

/** Параметры периода для API: пресет или from/to + tz. */
export interface PeriodParams {
  preset?: Preset
  from?: string
  to?: string
  tz: string
}

/**
 * Период хранится в URL (?preset=7d или ?from=…&to=…): ссылкой можно поделиться, F5 его не сбрасывает.
 * Сами даты пресета вычисляет сервер (PeriodResolver) — клиент их не считает.
 */
export function usePeriod() {
  const [state, setState] = useQueryStates(periodParsers, { history: 'replace' })

  const params = useMemo<PeriodParams>(() => {
    if (state.from && state.to) {
      return { from: toIsoDate(state.from), to: toIsoDate(state.to), tz: USER_TIME_ZONE }
    }
    return { preset: state.preset ?? DEFAULT_PRESET, tz: USER_TIME_ZONE }
  }, [state.preset, state.from, state.to])

  return {
    params,
    isCustom: Boolean(state.from && state.to),
    setPreset: (preset: Preset) => setState({ preset, from: null, to: null }),
    setRange: (from: Date, to: Date) => setState({ preset: null, from, to }),
  }
}
