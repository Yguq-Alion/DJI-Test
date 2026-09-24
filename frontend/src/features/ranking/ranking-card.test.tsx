import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { requests } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { RankingCard } from './ranking-card'

const managerNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent ?? '')

describe('рейтинг менеджеров', () => {
  test('по умолчанию ранжирует по валовой прибыли', async () => {
    renderWithProviders(<RankingCard />)

    await screen.findByText('Анна Соколова')
    expect(managerNames()[0]).toContain('Анна Соколова')
    expect(screen.getByRole('tab', { name: 'Валовая прибыль' })).toHaveAttribute('aria-selected', 'true')
  })

  test('переключение на средний чек перезапрашивает и переупорядочивает рейтинг', async () => {
    renderWithProviders(<RankingCard />)
    await screen.findByText('Анна Соколова')

    await userEvent.click(screen.getByRole('tab', { name: 'Средний чек' }))

    await waitFor(() => expect(managerNames()[0]).toContain('Борис Орлов'))
    expect(
      requests.some(
        (r) => r.pathname === '/api/managers/ranking' && r.searchParams.get('sortBy') === 'averageCheck',
      ),
    ).toBe(true)
  })

  test('клик по заголовку колонки сортирует таблицу, повторный — меняет направление', async () => {
    renderWithProviders(<RankingCard />)
    await screen.findByText('Анна Соколова')
    const header = screen.getByRole('columnheader', { name: /Средний чек/ })

    await userEvent.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'descending')
    expect(managerNames()).toEqual([
      expect.stringContaining('Борис Орлов'),
      expect.stringContaining('Анна Соколова'),
      // Без продаж (чека нет) — всегда внизу, в любом направлении.
      expect.stringContaining('Клара Волкова'),
    ])

    await userEvent.click(within(header).getByRole('button'))
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(managerNames()[0]).toContain('Анна Соколова')
    expect(managerNames()[2]).toContain('Клара Волкова')
    // Сортировка таблицы не перезапрашивает рейтинг — меняется только порядок строк.
    expect(requests.filter((r) => r.pathname === '/api/managers/ranking')).toHaveLength(1)
  })

  test('текстовая колонка сортируется по алфавиту, смена режима рейтинга сбрасывает сортировку', async () => {
    renderWithProviders(<RankingCard />)
    await screen.findByText('Анна Соколова')

    await userEvent.click(screen.getByRole('button', { name: 'Менеджер' }))
    expect(managerNames()).toEqual([
      expect.stringContaining('Анна'),
      expect.stringContaining('Борис'),
      expect.stringContaining('Клара'),
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Менеджер' }))
    expect(managerNames()[0]).toContain('Клара')

    await userEvent.click(screen.getByRole('tab', { name: 'Средний чек' }))
    await waitFor(() => expect(managerNames()[0]).toContain('Борис Орлов'))
    expect(screen.getByRole('columnheader', { name: /#/ })).toHaveAttribute('aria-sort', 'ascending')
  })

  test('менеджер без продаж показан без места и с пометкой', async () => {
    renderWithProviders(<RankingCard />)

    const row = (await screen.findByText('Клара Волкова')).closest('tr')!
    expect(within(row).getByText(/нет продаж за период/)).toBeInTheDocument()
  })
})
