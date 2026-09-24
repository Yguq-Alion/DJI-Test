import { useCategories } from '@/api/queries'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePeriod } from '@/features/period/period-state'
import { formatMoney, formatMoneyCompact, formatShare } from '@/lib/format'
import { cn } from '@/lib/utils'

export function CategoriesCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const query = useCategories(params)
  const items = query.data?.items ?? []
  const maxRevenue = Math.max(0, ...items.map((i) => i.revenue))

  return (
    <BlockCard
      title="Категории"
      hint="Чистая выручка категории (за вычетом возвратов в дату возврата), её доля в общей выручке и маржа — валовая прибыль / выручка."
      className={className}
    >
      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        isEmpty={items.every((i) => i.revenue === 0 && i.grossProfit === 0)}
        onRetry={() => void query.refetch()}
        skeleton={<ListSkeleton rows={6} />}
        emptyText="За период не было продаж ни в одной категории."
      >
        <ul className="space-y-3.5">
          {items.map((item) => (
            <li key={item.categoryId}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-default space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{item.category}</span>
                      <span className="shrink-0 tabular">{formatMoneyCompact(item.revenue)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-series-1 transition-[width] duration-500 ease-out"
                        style={{
                          width: `${maxRevenue > 0 ? Math.max(0, (item.revenue / maxRevenue) * 100) : 0}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground tabular">
                      <span>доля {formatShare(item.share)}</span>
                      <span className={cn(item.margin !== null && item.margin < 0 && 'text-critical')}>
                        маржа {formatShare(item.margin)}
                      </span>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <div className="font-medium">{item.category}</div>
                  <div>Выручка: {formatMoney(item.revenue)}</div>
                  <div>Валовая прибыль: {formatMoney(item.grossProfit)}</div>
                </TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      </QueryState>
    </BlockCard>
  )
}

export function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}
