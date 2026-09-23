import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { CategoriesCard } from '@/features/catalog/categories-card'
import { KpiGrid } from '@/features/kpi/kpi-grid'
import { emptyCategories, emptyKpi, kpi } from '@/test/fixtures'
import { problem, server } from '@/test/server'
import { renderWithProviders } from '@/test/render'

describe('состояния блоков', () => {
  test('initial loading: показывает скелетон, затем данные', async () => {
    server.use(
      http.get('*/api/dashboard/kpi', async () => {
        await delay(50)
        return HttpResponse.json(kpi)
      }),
    )
    const { container } = renderWithProviders(<KpiGrid />)

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
    expect(await screen.findByText('Анна Соколова')).toBeInTheDocument()
    expect(screen.getByText(/\+28,8/)).toBeInTheDocument()
  })

  test('ошибка API: показывает сообщение сервера и повторяет запрос', async () => {
    let calls = 0
    server.use(
      http.get('*/api/dashboard/kpi', () => {
        calls++
        return calls === 1 ? problem(500, 'Внутренняя ошибка сервера') : HttpResponse.json(kpi)
      }),
    )
    renderWithProviders(<KpiGrid />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Внутренняя ошибка сервера')
    await userEvent.click(screen.getByRole('button', { name: /повторить/i }))

    expect(await screen.findByText('Анна Соколова')).toBeInTheDocument()
    expect(calls).toBe(2)
  })

  test('сервер недоступен: понятное сообщение вместо вечного спиннера', async () => {
    server.use(http.get('*/api/dashboard/categories', () => HttpResponse.error()))
    renderWithProviders(<CategoriesCard />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер недоступен')
  })

  test('пустой период: KPI без продаж и объяснение в блоке', async () => {
    server.use(
      http.get('*/api/dashboard/kpi', () => HttpResponse.json(emptyKpi)),
      http.get('*/api/dashboard/categories', () => HttpResponse.json(emptyCategories)),
    )
    renderWithProviders(
      <>
        <KpiGrid />
        <CategoriesCard />
      </>,
    )

    expect(await screen.findByText('Нет продаж за период')).toBeInTheDocument()
    expect(await screen.findByText(/не было продаж ни в одной категории/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('нет данных для сравнения').length).toBeGreaterThan(0))
  })
})
