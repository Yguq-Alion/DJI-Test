import { Trophy } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useKpi, useTimeseries } from '@/api/queries'
import type { KpiResponse, KpiValue } from '@/api/types'
import { AnimatedNumber } from '@/components/dashboard/animated-number'
import { ErrorState } from '@/components/dashboard/block-card'
import { Delta } from '@/components/dashboard/delta'
import { ManagerAvatar } from '@/components/dashboard/manager-avatar'
import { Sparkline } from '@/components/dashboard/sparkline'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useGranularity } from '@/features/dynamics/granularity'
import { usePeriod } from '@/features/period/period-state'
import { useChartColors } from '@/hooks/use-chart-colors'
import { formatInteger, formatMoney, formatMoneyCompact, formatShare } from '@/lib/format'
import { cn } from '@/lib/utils'

interface TileProps {
  label: string
  value: ReactNode
  exact?: string
  metric?: KpiValue
  invert?: boolean
  footnote?: ReactNode
  spark?: { values: number[]; color: string }
  className?: string
}

const tileMotion = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
} as const

function KpiTile({ label, value, exact, metric, invert, footnote, spark, className }: TileProps) {
  const valueNode = <div className="font-heading text-2xl font-semibold tracking-tight">{value}</div>
  return (
    <MotionCard variants={tileMotion} className={cn('gap-2 px-5 py-4', className)}>
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
      {spark && <Sparkline values={spark.values} color={spark.color} className="mt-auto h-7 w-full" />}
    </MotionCard>
  )
}

const MotionCard = motion.create(Card)

function BestManagerTile({ best }: { best: KpiResponse['bestManager'] }) {
  return (
    <MotionCard variants={tileMotion} className="col-span-2 gap-2 px-5 py-4">
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
    </MotionCard>
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
  const [granularity] = useGranularity()
  // Спарклайны берут те же точки, что и график динамики (запрос общий, из кэша).
  const series = useTimeseries(params, granularity).data?.points ?? []
  const colors = useChartColors()

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
    <motion.section
      aria-label="Ключевые показатели"
      aria-busy={isFetching}
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className={cn('grid grid-cols-7 gap-4 transition-opacity duration-300', isFetching && 'opacity-60')}
    >
      <KpiTile
        label="Выручка"
        value={<AnimatedNumber value={data.revenue.value} format={formatMoneyCompact} />}
        exact={formatMoney(data.revenue.value)}
        metric={data.revenue}
        spark={{ values: series.map((p) => p.revenue), color: colors.series1 }}
        footnote={refunds > 0 ? `возвраты −${formatMoneyCompact(refunds)}` : undefined}
      />
      <KpiTile
        label="Валовая прибыль"
        value={<AnimatedNumber value={data.grossProfit.value} format={formatMoneyCompact} />}
        exact={formatMoney(data.grossProfit.value)}
        metric={data.grossProfit}
        spark={{ values: series.map((p) => p.grossProfit), color: colors.series2 }}
      />
      <KpiTile
        label="Маржинальность"
        value={<AnimatedNumber value={data.margin.value} format={formatShare} />}
        metric={data.margin}
      />
      <KpiTile
        label="Продажи"
        value={<AnimatedNumber value={data.salesCount.value} format={formatInteger} />}
        metric={data.salesCount}
        spark={{ values: series.map((p) => p.salesCount), color: colors.series3 }}
        footnote={
          data.refundRate.value !== null ? `возвратов ${formatShare(data.refundRate.value)}` : undefined
        }
      />
      <KpiTile
        label="Средний чек"
        value={<AnimatedNumber value={data.averageCheck.value} format={formatMoneyCompact} />}
        exact={formatMoney(data.averageCheck.value)}
        metric={data.averageCheck}
      />
      <BestManagerTile best={data.bestManager} />
    </motion.section>
  )
}
