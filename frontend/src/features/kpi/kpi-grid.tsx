import { Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { useKpi } from '@/api/queries'
import type { KpiResponse, KpiValue } from '@/api/types'
import { ErrorState } from '@/components/dashboard/block-card'
import { Delta } from '@/components/dashboard/delta'
import { ManagerAvatar } from '@/components/dashboard/manager-avatar'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePeriod } from '@/features/period/period-state'
import { DASH, formatInteger, formatMoney, formatMoneyCompact, formatShare } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TileProps {
  label: string
  value: ReactNode
  exact?: string
  metric?: KpiValue
  invert?: boolean
  footnote?: ReactNode
  className?: string
}

function KpiTile({ label, value, exact, metric, invert, footnote, className }: TileProps) {
  const valueNode = <div className="font-heading text-2xl font-semibold tracking-tight">{value}</div>
  return (
    <Card className={cn('gap-2 px-5 py-4', className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      {exact ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-fit cursor-default">{valueNode}</div>
          </TooltipTrigger>
          <TooltipContent>{exact}</TooltipContent>
        </Tooltip>
      ) : (
        valueNode
      )}
      <div className="flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
        {metric && <Delta change={metric.change} kind={metric.changeKind} invert={invert} />}
        {footnote && <span className="text-xs text-muted-foreground">{footnote}</span>}
      </div>
    </Card>
  )
}

function BestManagerTile({ best }: { best: KpiResponse['bestManager'] }) {
  return (
    <Card className="col-span-2 gap-2 px-5 py-4">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Trophy className="size-3.5 text-warning" aria-hidden /> Лучший менеджер
      </div>
      {best ? (
        <>
          <div className="flex items-center gap-2.5">
            <ManagerAvatar manager={best.manager} />
            <div className="min-w-0">
              <div className="truncate font-semibold">{best.manager.fullName}</div>
              <div className="truncate text-xs text-muted-foreground">{best.manager.team}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <MiniStat label="Прибыль" value={formatMoneyCompact(best.grossProfit)} />
            <MiniStat label="Выручка" value={formatMoneyCompact(best.revenue)} />
            <MiniStat label="Возвраты" value={formatShare(best.refundRate)} />
          </div>
        </>
      ) : (
        <div className="text-sm text-muted-foreground">Нет продаж за период</div>
      )}
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-medium tabular">{value}</div>
    </div>
  )
}

export function KpiGrid() {
  const { params } = usePeriod()
  const { data, isPending, isError, error, isFetching, refetch } = useKpi(params)

  if (isPending) {
    return (
      <div className="grid grid-cols-7 gap-4" aria-busy="true">
        {Array.from({ length: 7 }, (_, i) => (
          <Card key={i} className="gap-3 px-5 py-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-20" />
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="px-5 py-4">
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      </Card>
    )
  }

  const refunds = data.refundedAmount.value ?? 0
  return (
    <section
      aria-label="Ключевые показатели"
      aria-busy={isFetching}
      className={cn('grid grid-cols-7 gap-4 transition-opacity duration-300', isFetching && 'opacity-60')}
    >
      <KpiTile
        label="Выручка"
        value={formatMoneyCompact(data.revenue.value)}
        exact={formatMoney(data.revenue.value)}
        metric={data.revenue}
        footnote={refunds > 0 ? `возвраты −${formatMoneyCompact(refunds)}` : undefined}
      />
      <KpiTile
        label="Валовая прибыль"
        value={formatMoneyCompact(data.grossProfit.value)}
        exact={formatMoney(data.grossProfit.value)}
        metric={data.grossProfit}
      />
      <KpiTile label="Маржинальность" value={formatShare(data.margin.value)} metric={data.margin} />
      <KpiTile
        label="Продажи"
        value={formatInteger(data.salesCount.value)}
        metric={data.salesCount}
        footnote={
          data.refundRate.value !== null ? `возвратов ${formatShare(data.refundRate.value)}` : undefined
        }
      />
      <KpiTile
        label="Средний чек"
        value={data.averageCheck.value === null ? DASH : formatMoneyCompact(data.averageCheck.value)}
        exact={formatMoney(data.averageCheck.value)}
        metric={data.averageCheck}
      />
      <BestManagerTile best={data.bestManager} />
    </section>
  )
}
