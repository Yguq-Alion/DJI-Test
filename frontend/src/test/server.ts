import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { categories, kpi, rankingByCheck, rankingByProfit, recentSales, recentSalesPage2 } from './fixtures'

/** Запросы к API, которые видел сервер (для проверки параметров). */
export const requests: URL[] = []

export const handlers = [
  http.get('*/api/dashboard/kpi', () => HttpResponse.json(kpi)),
  http.get('*/api/managers/ranking', ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('sortBy') === 'averageCheck' ? rankingByCheck : rankingByProfit,
    ),
  ),
  http.get('*/api/dashboard/categories', () => HttpResponse.json(categories)),
  http.get('*/api/sales/recent', ({ request }) =>
    HttpResponse.json(new URL(request.url).searchParams.get('page') === '2' ? recentSalesPage2 : recentSales),
  ),
  http.get('*/api/dashboard/timeseries', () =>
    HttpResponse.json({ period: kpi.period, granularity: 'day', points: [] }),
  ),
]

export const server = setupServer(...handlers)

server.events.on('request:start', ({ request }) => {
  requests.push(new URL(request.url))
})

export function problem(status: number, title: string) {
  return HttpResponse.json(
    { status, title },
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  )
}
