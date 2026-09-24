import { render, screen } from '@testing-library/react'
import { AppProviders } from '@/app/providers'
import App from '@/App'

test('renders dashboard shell', () => {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  )
  expect(screen.getByRole('heading', { name: 'Статистика продаж DJS' })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Период' })).toBeInTheDocument()
  // Период — в начале статистики, а не в шапке.
  expect(screen.getByRole('banner')).not.toContainElement(screen.getByRole('radiogroup', { name: 'Период' }))
  expect(screen.queryByText(/Периоды считаются в вашем часовом поясе/)).not.toBeInTheDocument()
})
