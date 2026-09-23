import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UrlUpdateEvent } from 'nuqs/adapters/testing'
import { KpiGrid } from '@/features/kpi/kpi-grid'
import { requests } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { PeriodPicker } from './period-picker'

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

  test('произвольный период из URL передаётся как from/to', async () => {
    renderWithProviders(<KpiGrid />, { search: '?from=2026-06-01&to=2026-06-10' })

    await screen.findByText('Анна Соколова')
    const params = kpiRequests()[0].searchParams
    expect(params.get('from')).toBe('2026-06-01')
    expect(params.get('to')).toBe('2026-06-10')
    expect(params.get('preset')).toBeNull()
  })
})
