import { render, screen } from '@testing-library/react'
import App from '@/App'

test('renders dashboard title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /sales performance/i })).toBeInTheDocument()
})
