import type { TimeseriesPoint } from '@/api/types'

export interface RefundMarker {
  bucketStart: string
  refundsCount: number
  refundedAmount: number
  /** Радиус отметки в пикселях: крупнее для бакетов с большей суммой возвратов. */
  radius: number
}

const MIN_RADIUS = 3.5
const MAX_RADIUS = 7

/** Отметки возвратов для графика: только бакеты, где были возвраты; размер — по сумме относительно максимума. */
export function refundMarkers(points: readonly TimeseriesPoint[]): RefundMarker[] {
  const withRefunds = points.filter((p) => p.refundsCount > 0)
  const maxAmount = Math.max(0, ...withRefunds.map((p) => p.refundedAmount))
  return withRefunds.map((p) => ({
    bucketStart: p.bucketStart,
    refundsCount: p.refundsCount,
    refundedAmount: p.refundedAmount,
    radius:
      maxAmount > 0
        ? MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(p.refundedAmount / maxAmount)
        : MIN_RADIUS,
  }))
}
