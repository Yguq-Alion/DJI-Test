import { lazy, Suspense } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoriesCard } from '@/features/catalog/categories-card'
import { TopProductsCard } from '@/features/catalog/top-products-card'
import { KpiGrid } from '@/features/kpi/kpi-grid'
import { PeriodPicker } from '@/features/period/period-picker'
import { RankingCard } from '@/features/ranking/ranking-card'
import { RecentSalesCard } from '@/features/sales/recent-sales-card'
import { ThemeToggle } from '@/features/theme/theme-toggle'

// Nivo — самая тяжёлая зависимость; график грузится отдельным чанком, не задерживая первый экран.
const DynamicsCard = lazy(() =>
  import('@/features/dynamics/dynamics-card').then((m) => ({ default: m.DynamicsCard })),
)

export default function App() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-8 py-3">
          <h1 className="col-start-2 font-heading text-lg leading-tight font-semibold tracking-tight">
            Статистика продаж DJS
          </h1>
          <div className="justify-self-end">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-8 py-6">
        <PeriodPicker />
        <KpiGrid />
        <Suspense
          fallback={
            <Card className="p-6">
              <Skeleton className="h-[420px] w-full" />
            </Card>
          }
        >
          <DynamicsCard />
        </Suspense>
        <div className="grid grid-cols-12 gap-4">
          <RankingCard className="col-span-8" />
          <div className="col-span-4 flex flex-col gap-4">
            <CategoriesCard />
            <TopProductsCard />
          </div>
        </div>
        <RecentSalesCard />
      </main>
    </div>
  )
}
