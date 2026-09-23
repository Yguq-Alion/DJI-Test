import { useTopProducts } from '@/api/queries'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { usePeriod } from '@/features/period/period-state'
import { formatInteger, formatMoneyCompact, formatShare } from '@/lib/format'
import { ListSkeleton } from './categories-card'

export function TopProductsCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const query = useTopProducts(params)
  const items = query.data?.items ?? []

  return (
    <BlockCard title="Лучшие товары" description="По чистой выручке за период" className={className}>
      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        isEmpty={items.length === 0}
        onRetry={() => void query.refetch()}
        skeleton={<ListSkeleton rows={8} />}
        emptyText="За период нет продаж."
      >
        <ol className="divide-y">
          {items.map((item, index) => (
            <li key={item.productId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-5 text-sm font-semibold text-muted-foreground tabular">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{item.product}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.category} · {formatInteger(item.quantity)} шт.
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium tabular">{formatMoneyCompact(item.revenue)}</div>
                <div className="text-xs text-muted-foreground tabular">маржа {formatShare(item.margin)}</div>
              </div>
            </li>
          ))}
        </ol>
      </QueryState>
    </BlockCard>
  )
}
