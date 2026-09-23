import { render, screen } from '@testing-library/react'
import { AppProviders } from '@/app/providers'
import App from '@/App'

test('renders dashboard shell', () => {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  )
  expect(screen.getByRole('heading', { name: /sales performance/i })).toBeInTheDocument()
  expect(screen.getByRole('radiogroup', { name: 'Период' })).toBeInTheDocument()
})
