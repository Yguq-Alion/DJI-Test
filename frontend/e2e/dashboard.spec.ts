import { expect, test } from '@playwright/test'

test('dashboard loads with seeded data', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sales Performance' })).toBeVisible()
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
