import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { KpiGrid } from '@/features/kpi/kpi-grid'
import { requests } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { PeriodPicker, previewRange } from './period-picker'

describe('предпросмотр диапазона в календаре', () => {
  const d = (day: number) => new Date(2026, 8, day)

  test('после первой даты подсвечивает до даты под курсором в любую сторону', () => {
    expect(previewRange({ from: d(10), to: undefined }, d(15))).toEqual({ from: d(10), to: d(15) })
    expect(previewRange({ from: d(10), to: undefined }, d(3))).toEqual({ from: d(3), to: d(10) })
  })

  test('без незавершённого выбора предпросмотра нет', () => {
    expect(previewRange(undefined, d(15))).toBeUndefined()
    expect(previewRange({ from: d(10), to: d(12) }, d(15))).toBeUndefined()
    expect(previewRange({ from: d(10), to: undefined }, undefined)).toBeUndefined()
  })
})

const kpiRequests = () => requests.filter((r) => r.pathname === '/api/dashboard/kpi')

describe('смена периода', () => {
  test('по умолчанию запрашивает 30 дней в поясе браузера', async () => {
    renderWithProviders(<KpiGrid />)

    await screen.findByText('Анна Соколова')
    const params = kpiRequests()[0].searchParams
    expect(params.get('preset')).toBe('30d')
    expect(params.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone)
  })

  test('выбор пресета обновляет URL и перезапрашивает данные', async () => {
    const updates: UrlUpdateEvent[] = []
    renderWithProviders(
      <>
        <PeriodPicker />
        <KpiGrid />
      </>,
      { onUrlUpdate: (e) => updates.push(e) },
    )
    await screen.findByText('Анна Соколова')

    await userEvent.click(screen.getByRole('radio', { name: '7 дней' }))

    await waitFor(() => expect(kpiRequests().some((r) => r.searchParams.get('preset') === '7d')).toBe(true))
    expect(updates.at(-1)?.queryString).toContain('preset=7d')
    expect(screen.getByRole('radio', { name: '7 дней' })).toHaveAttribute('data-state', 'on')
  })

  test('календарь открывается с подсвеченными датами текущего периода, в т.ч. для пресета', async () => {
    renderWithProviders(<PeriodPicker />)
    // Даты пресета 30d берутся из ответа сервера (фикстура: 25 авг. – 23 сент.).
    expect(await screen.findByText(/25 авг\. – 23 сентября/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Произвольный период' }))

    const selected = (await screen.findAllByRole('button', { name: /selected/ })).filter((b) =>
      /2026/.test(b.getAttribute('aria-label') ?? ''),
    )
    const labels = selected.map((b) => b.getAttribute('aria-label'))
    expect(labels.some((l) => l?.includes('25 августа'))).toBe(true)
    expect(labels.some((l) => l?.includes('23 сентября'))).toBe(true)
    expect(labels.some((l) => l?.includes('24 сентября'))).toBe(false)
  })

  test('произвольный период из URL передаётся как from/to', async () => {
    renderWithProviders(<KpiGrid />, { search: '?from=2026-06-01&to=2026-06-10' })

    await screen.findByText('Анна Соколова')
    const params = kpiRequests()[0].searchParams
    expect(params.get('from')).toBe('2026-06-01')
    expect(params.get('to')).toBe('2026-06-10')
    expect(params.get('preset')).toBeNull()
  })
})
