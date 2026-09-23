import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { NuqsTestingAdapter, type OnUrlUpdateFunction } from 'nuqs/adapters/testing'
import type { ReactElement } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'

/** Рендер с изолированным QueryClient и управляемым URL (nuqs). */
export function renderWithProviders(
  ui: ReactElement,
  options: { search?: string; onUrlUpdate?: OnUrlUpdateFunction } = {},
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={options.search ?? ''} onUrlUpdate={options.onUrlUpdate} hasMemory>
        <TooltipProvider>{ui}</TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  )
}
