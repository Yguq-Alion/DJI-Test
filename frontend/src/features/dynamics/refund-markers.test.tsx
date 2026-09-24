import { render, screen } from '@testing-library/react'
import type { ChartColors } from '@/hooks/use-chart-colors'
import { timeseries } from '@/test/fixtures'
import { ChartTooltip } from './dynamics-card'
import { refundMarkers } from './refund-markers'

const colors = {} as ChartColors

describe('отметки возвратов на графике', () => {
  test('только бакеты с возвратами; крупнее там, где сумма возвратов больше', () => {
    const markers = refundMarkers(timeseries.points)

    expect(markers.map((m) => m.bucketStart)).toEqual(['2026-09-02T00:00:00', '2026-09-03T00:00:00'])
    expect(markers[0].refundsCount).toBe(2)
    expect(markers[0].radius).toBeGreaterThan(markers[1].radius)
    expect(markers[0].radius).toBeLessThanOrEqual(7)
    expect(markers[1].radius).toBeGreaterThanOrEqual(3.5)
  })

  test('нет возвратов — нет отметок', () => {
    expect(
      refundMarkers(timeseries.points.map((p) => ({ ...p, refundsCount: 0, refundedAmount: 0 }))),
    ).toEqual([])
  })

  test('подсказка графика показывает возвраты бакета, а без возвратов — не показывает строку', () => {
    const { rerender } = render(
      <ChartTooltip point={timeseries.points[1]} granularity="day" colors={colors} />,
    )
    expect(screen.getByText('Возвраты (2)')).toBeInTheDocument()
    expect(screen.getByText(/−450\s000/)).toBeInTheDocument()

    rerender(<ChartTooltip point={timeseries.points[0]} granularity="day" colors={colors} />)
    expect(screen.queryByText(/Возвраты/)).not.toBeInTheDocument()
  })
})
