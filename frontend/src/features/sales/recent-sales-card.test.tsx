import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { requests } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { RecentSalesCard } from './recent-sales-card'

const salesRequests = () => requests.filter((r) => r.pathname === '/api/sales/recent')

describe('последние продажи', () => {
  test('по умолчанию отсортированы по дате, от новых к старым — это видно в заголовке', async () => {
    renderWithProviders(<RecentSalesCard />)
    await screen.findByText('ООО «ГеоСервис»')

    expect(screen.getByRole('columnheader', { name: /Дата/ })).toHaveAttribute('aria-sort', 'descending')
    const params = salesRequests()[0].searchParams
    expect(params.get('sortBy')).toBe('soldAt')
    expect(params.get('sortDir')).toBe('desc')
    expect(params.get('page')).toBe('1')
  })

  test('клик по колонке сортирует на сервере, повторный — меняет направление', async () => {
    renderWithProviders(<RecentSalesCard />)
    await screen.findByText('ООО «ГеоСервис»')
    const amount = screen.getByRole('columnheader', { name: /Сумма/ })

    await userEvent.click(within(amount).getByRole('button'))
    await waitFor(() => expect(salesRequests().at(-1)?.searchParams.get('sortBy')).toBe('amount'))
    expect(salesRequests().at(-1)?.searchParams.get('sortDir')).toBe('desc')
    expect(amount).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByRole('columnheader', { name: /Дата/ })).toHaveAttribute('aria-sort', 'none')

    await userEvent.click(within(amount).getByRole('button'))
    await waitFor(() => expect(salesRequests().at(-1)?.searchParams.get('sortDir')).toBe('asc'))
    // Текстовые колонки начинают с алфавитного порядка.
    await userEvent.click(screen.getByRole('button', { name: 'Клиент' }))
    await waitFor(() => expect(salesRequests().at(-1)?.searchParams.get('sortBy')).toBe('customer'))
    expect(salesRequests().at(-1)?.searchParams.get('sortDir')).toBe('asc')
  })

  test('показывает текущую страницу и общее число страниц, «Загрузить ещё» догружает следующую', async () => {
    renderWithProviders(<RecentSalesCard />)
    await screen.findByText('ООО «ГеоСервис»')
    expect(screen.getByText(/Страница 1 из 2 · показано 1 из 13/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Загрузить ещё' }))

    expect(await screen.findByText('ИП «АгроТех»')).toBeInTheDocument()
    expect(screen.getByText(/Страница 2 из 2 · показано 2 из 13/)).toBeInTheDocument()
    expect(salesRequests().at(-1)?.searchParams.get('page')).toBe('2')
    // Последняя страница — кнопки больше нет.
    expect(screen.queryByRole('button', { name: 'Загрузить ещё' })).not.toBeInTheDocument()
  })
})
