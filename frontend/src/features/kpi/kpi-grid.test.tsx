import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { KpiGrid } from './kpi-grid'

describe('подсказки к KPI', () => {
  test('каждое значение метрики — с пояснением по наведению', async () => {
    renderWithProviders(<KpiGrid />)
    await screen.findByText('Анна Соколова')

    // Пять метрик + лучший менеджер; все подсказки доступны и с клавиатуры.
    const hints = document.querySelectorAll('.cursor-help')
    expect(hints).toHaveLength(6)
  })

  test('подсказка выручки объясняет возвраты, показывает точную сумму и период сравнения', async () => {
    renderWithProviders(<KpiGrid />)
    await screen.findByText('Анна Соколова')

    await userEvent.hover(document.querySelectorAll('.cursor-help')[0])

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/в дату возврата/)
    expect(tooltip).toHaveTextContent(/252\s352\s290/)
    expect(tooltip).toHaveTextContent(/к периоду 26 июл\. – 24 августа/)
  })
})
