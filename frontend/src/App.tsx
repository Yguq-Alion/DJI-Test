import { Separator } from '@/components/ui/separator'
import { CategoriesCard } from '@/features/catalog/categories-card'
import { TopProductsCard } from '@/features/catalog/top-products-card'
import { KpiGrid } from '@/features/kpi/kpi-grid'
import { PeriodPicker } from '@/features/period/period-picker'
import { USER_TIME_ZONE } from '@/features/period/period-state'
import { RankingCard } from '@/features/ranking/ranking-card'
import { RecentSalesCard } from '@/features/sales/recent-sales-card'
import { ThemeToggle } from '@/features/theme/theme-toggle'

export default function App() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-8 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              DM
            </div>
            <div>
              <h1 className="font-heading text-lg leading-tight font-semibold tracking-tight">
                Sales Performance
              </h1>
              <p className="text-xs text-muted-foreground">Аналитика продаж менеджеров · DJI-Market</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PeriodPicker />
            <Separator orientation="vertical" className="h-6" />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-8 py-6">
        <KpiGrid />
        <div className="grid grid-cols-12 gap-4">
          <RankingCard className="col-span-8" />
          <div className="col-span-4 flex flex-col gap-4">
            <CategoriesCard />
            <TopProductsCard />
          </div>
        </div>
        <RecentSalesCard />
        <footer className="pb-2 text-center text-xs text-muted-foreground">
          Периоды считаются в вашем часовом поясе ({USER_TIME_ZONE}). Выручка — за вычетом возвратов в дату
          возврата.
        </footer>
      </main>
    </div>
  )
}
