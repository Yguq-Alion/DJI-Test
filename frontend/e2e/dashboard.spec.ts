import { expect, test } from '@playwright/test'

test('dashboard loads with seeded data', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Статистика продаж DJS' })).toBeVisible()
  const kpi = page.getByRole('region', { name: 'Ключевые показатели' })
  await expect(kpi.getByText('Выручка').first()).toBeVisible()
  await expect(kpi.getByText(/₽/).first()).toBeVisible()
  await expect(page.getByText('Лучший менеджер')).toBeVisible()
  await expect(page.getByRole('img', { name: 'График выручки и валовой прибыли' })).toBeVisible()
  // Рейтинг: 15+ менеджеров из seed.
  await expect(page.getByRole('table').first().getByRole('row')).not.toHaveCount(1)
})

test('changing the period updates URL and data', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Лучший менеджер')).toBeVisible()

  const kpiResponse = page.waitForResponse(
    (r) => r.url().includes('/api/dashboard/kpi') && r.url().includes('preset=lastMonth'),
  )
  await page.getByRole('radio', { name: 'Прошлый месяц' }).click()
  expect((await kpiResponse).status()).toBe(200)
  await expect(page).toHaveURL(/preset=lastMonth/)

  // F5 сохраняет выбранный период.
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Прошлый месяц' })).toHaveAttribute('data-state', 'on')
})

test('ranking switches between gross profit and average check', async ({ page }) => {
  await page.goto('/?preset=30d')
  const averageCheck = page.getByRole('tab', { name: 'Средний чек' })

  const response = page.waitForResponse(
    (r) => r.url().includes('/api/managers/ranking') && r.url().includes('sortBy=averageCheck'),
  )
  await averageCheck.click()
  expect((await response).status()).toBe(200)
  await expect(averageCheck).toHaveAttribute('aria-selected', 'true')
  await expect(page).toHaveURL(/rank=averageCheck/)
})

test('empty period shows explanations instead of blank blocks', async ({ page }) => {
  await page.goto('/?from=2020-01-01&to=2020-01-31')

  await expect(page.getByText('Нет продаж за период', { exact: true })).toBeVisible()
  await expect(page.getByText('За выбранный период продаж нет.')).toBeVisible()
})

test('recent sales sort by column on the server and show page counter', async ({ page }) => {
  await page.goto('/?preset=30d')
  const sales = page.locator('[data-slot=card]', { has: page.getByText('Последние продажи') })
  await expect(sales.getByRole('columnheader', { name: /Дата/ })).toHaveAttribute('aria-sort', 'descending')
  await expect(sales.getByText(/Страница 1 из \d+/)).toBeVisible()

  const response = page.waitForResponse(
    (r) =>
      r.url().includes('/api/sales/recent') &&
      r.url().includes('sortBy=amount') &&
      r.url().includes('sortDir=desc'),
  )
  await sales.getByRole('button', { name: 'Сумма' }).click()
  const body = (await (await response).json()) as { items: { amount: number }[] }
  const amounts = body.items.map((i) => i.amount)
  expect(amounts).toEqual([...amounts].sort((a, b) => b - a))

  await sales.getByRole('button', { name: 'Загрузить ещё' }).click()
  await expect(sales.getByText(/Страница 2 из \d+/)).toBeVisible()
})

test('ranking columns are sortable by click', async ({ page }) => {
  await page.goto('/?preset=30d')
  const ranking = page.locator('[data-slot=card]', { has: page.getByText('Рейтинг менеджеров') })
  await expect(ranking.getByRole('row')).not.toHaveCount(1)

  await ranking.getByRole('button', { name: 'Продажи' }).click()
  await expect(ranking.getByRole('columnheader', { name: /Продажи/ })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  const counts = await ranking.locator('tbody tr td:nth-child(3)').allTextContents()
  const numbers = counts.map((c) => Number(c.replace(/\D/g, '')))
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a))
})

test('profit chart marks refunds and KPI values explain themselves on hover', async ({ page }) => {
  await page.goto('/?preset=30d')

  // Seed содержит возвраты почти каждую неделю — за 30 дней отметки обязаны быть.
  await expect(page.locator('g[aria-label="Возвраты"] circle').first()).toBeVisible()

  const kpi = page.getByRole('region', { name: 'Ключевые показатели' })
  await kpi.locator('.cursor-help').first().hover()
  await expect(page.getByRole('tooltip')).toContainText('в дату возврата')
})
