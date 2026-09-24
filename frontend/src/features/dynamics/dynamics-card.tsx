import { ResponsiveBar } from '@nivo/bar'
import { type LineCustomSvgLayerProps, ResponsiveLine, type SliceTooltipProps } from '@nivo/line'
import { useCallback, useMemo } from 'react'
import { useTimeseries } from '@/api/queries'
import type { Granularity, TimeseriesPoint } from '@/api/types'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { usePeriod } from '@/features/period/period-state'
import { type ChartColors, useChartColors } from '@/hooks/use-chart-colors'
import { formatInteger, formatMoney, formatMoneyCompact } from '@/lib/format'
import { formatBucketTick, formatBucketTitle, GRANULARITY_OPTIONS, useGranularity } from './granularity'
import { refundMarkers } from './refund-markers'

const PROFIT_SERIES = 'Валовая прибыль'
const MARGIN = { top: 12, right: 16, bottom: 8, left: 72 }
const GRANULARITY_LABEL: Record<Granularity, string> = {
  hour: 'по часам',
  day: 'по дням',
  week: 'по неделям',
  month: 'по месяцам',
}

function nivoTheme(colors: ChartColors) {
  return {
    text: { fill: colors.muted, fontSize: 11 },
    axis: {
      domain: { line: { stroke: 'transparent' } },
      ticks: { line: { stroke: 'transparent' }, text: { fill: colors.muted, fontSize: 11 } },
    },
    grid: { line: { stroke: colors.grid, strokeWidth: 1 } },
    crosshair: { line: { stroke: colors.muted, strokeWidth: 1, strokeOpacity: 0.6, strokeDasharray: '4 4' } },
  }
}

/**
 * Динамика: выручка и валовая прибыль на одной денежной оси, количество продаж — отдельным
 * графиком под ним с той же осью X (две разные шкалы на одном графике вводят в заблуждение).
 */
export function DynamicsCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const [granularity, setGranularity] = useGranularity()
  const query = useTimeseries(params, granularity)
  const points = query.data?.points ?? []

  return (
    <BlockCard
      title="Динамика"
      hint={
        <>
          Выручка и валовая прибыль {GRANULARITY_LABEL[query.data?.granularity ?? 'day']}. Возвраты вычитаются
          в дату возврата, а не в дату продажи, поэтому прибыль в отдельные дни может быть отрицательной.
          Красные отметки на линии прибыли — дни с возвратами.
        </>
      }
      className={className}
      action={
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Шаг графика"
          value={granularity}
          onValueChange={(value) => value && void setGranularity(value as typeof granularity)}
        >
          {GRANULARITY_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="px-3">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
    >
      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        isEmpty={points.every((p) => p.revenue === 0 && p.grossProfit === 0 && p.salesCount === 0)}
        onRetry={() => void query.refetch()}
        skeleton={<Skeleton className="h-[340px] w-full" />}
        emptyText="За выбранный период продаж и возвратов не было — графику нечего показать."
      >
        {query.data && <DynamicsCharts points={points} granularity={query.data.granularity} />}
      </QueryState>
    </BlockCard>
  )
}

function DynamicsCharts({ points, granularity }: { points: TimeseriesPoint[]; granularity: Granularity }) {
  const colors = useChartColors()
  const theme = useMemo(() => nivoTheme(colors), [colors])
  const byBucket = useMemo(() => new Map(points.map((p) => [p.bucketStart, p])), [points])

  // Подписи оси: не больше ~12, чтобы не слипались.
  const every = Math.max(1, Math.ceil(points.length / 12))
  const tickValues = points.filter((_, i) => i % every === 0).map((p) => p.bucketStart)

  const lineData = useMemo(
    () => [
      { id: 'Выручка', color: colors.series1, data: points.map((p) => ({ x: p.bucketStart, y: p.revenue })) },
      {
        id: PROFIT_SERIES,
        color: colors.series2,
        data: points.map((p) => ({ x: p.bucketStart, y: p.grossProfit })),
      },
    ],
    [points, colors],
  )

  const markers = useMemo(() => refundMarkers(points), [points])

  // Красные отметки на линии прибыли в бакетах с возвратами (размер — по сумме возвратов).
  const RefundMarkersLayer = useCallback(
    ({ points: linePoints }: LineCustomSvgLayerProps<(typeof lineData)[number]>) => {
      const profitPoints = new Map(
        linePoints.filter((p) => p.seriesId === PROFIT_SERIES).map((p) => [String(p.data.x), p]),
      )
      return (
        <g aria-label="Возвраты">
          {markers.map((m) => {
            const point = profitPoints.get(m.bucketStart)
            if (!point) return null
            return (
              <circle
                key={m.bucketStart}
                cx={point.x}
                cy={point.y}
                r={m.radius}
                fill={colors.critical}
                fillOpacity={0.85}
                stroke={colors.surface}
                strokeWidth={1.5}
              />
            )
          })}
        </g>
      )
    },
    [markers, colors],
  )

  const sliceTooltip = ({ slice }: SliceTooltipProps<(typeof lineData)[number]>) => {
    const bucket = String(slice.points[0]?.data.x ?? '')
    const point = byBucket.get(bucket)
    if (!point) return null
    return <ChartTooltip point={point} granularity={granularity} colors={colors} />
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 pl-[72px] text-xs text-muted-foreground" aria-hidden>
        <LegendItem color={colors.series1} label="Выручка" />
        <LegendItem color={colors.series2} label="Валовая прибыль" />
        {markers.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: colors.critical }} />
            Возвраты
          </span>
        )}
      </div>
      <div className="h-[250px]" role="img" aria-label="График выручки и валовой прибыли">
        <ResponsiveLine
          data={lineData}
          theme={theme}
          margin={MARGIN}
          xScale={{ type: 'point' }}
          yScale={{ type: 'linear', min: 'auto', max: 'auto', nice: true }}
          colors={(serie) => serie.color}
          lineWidth={2}
          curve="monotoneX"
          enablePoints={points.length <= 40}
          pointSize={6}
          pointColor={colors.surface}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'seriesColor' }}
          enableArea
          areaOpacity={0.06}
          areaBaselineValue={0}
          enableGridX={false}
          gridYValues={5}
          axisBottom={null}
          axisLeft={{ tickValues: 5, tickPadding: 8, format: (v) => formatMoneyCompact(Number(v)) }}
          enableSlices="x"
          sliceTooltip={sliceTooltip}
          markers={[{ axis: 'y', value: 0, lineStyle: { stroke: colors.axis, strokeWidth: 1 } }]}
          layers={[
            'grid',
            'markers',
            'axes',
            'areas',
            'crosshair',
            'lines',
            'points',
            RefundMarkersLayer,
            'slices',
            'mesh',
          ]}
          animate
          motionConfig="gentle"
        />
      </div>
      <div className="h-[92px]" role="img" aria-label="Количество продаж">
        <ResponsiveBar
          data={points.map((p) => ({ bucket: p.bucketStart, sales: p.salesCount }))}
          keys={['sales']}
          indexBy="bucket"
          theme={theme}
          margin={{ top: 4, right: MARGIN.right, bottom: 24, left: MARGIN.left }}
          padding={0.3}
          colors={[colors.series3]}
          borderRadius={2}
          enableLabel={false}
          enableGridY={false}
          axisLeft={{ tickValues: 2, tickPadding: 8, legend: '', format: (v) => formatInteger(Number(v)) }}
          axisBottom={{ tickValues, tickPadding: 6, format: (v) => formatBucketTick(String(v), granularity) }}
          tooltip={({ indexValue }) => {
            const point = byBucket.get(String(indexValue))
            return point ? <ChartTooltip point={point} granularity={granularity} colors={colors} /> : null
          }}
          animate
          motionConfig="gentle"
        />
      </div>
      <div className="pl-[72px] text-xs text-muted-foreground" aria-hidden>
        <LegendItem color={colors.series3} label="Количество продаж" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-0.5 w-3.5 rounded-full" style={{ backgroundColor: color, height: 3 }} />
      {label}
    </span>
  )
}

export function ChartTooltip({
  point,
  granularity,
  colors,
}: {
  point: TimeseriesPoint
  granularity: Granularity
  colors: ChartColors
}) {
  return (
    <div className="min-w-52 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="mb-1.5 font-medium">{formatBucketTitle(point.bucketStart, granularity)}</div>
      <TooltipRow color={colors.series1} label="Выручка" value={formatMoney(point.revenue)} />
      <TooltipRow color={colors.series2} label="Валовая прибыль" value={formatMoney(point.grossProfit)} />
      <TooltipRow color={colors.series3} label="Продажи" value={formatInteger(point.salesCount)} />
      {point.refundsCount > 0 && (
        <TooltipRow
          color={colors.critical}
          label={`Возвраты (${formatInteger(point.refundsCount)})`}
          value={`−${formatMoney(point.refundedAmount)}`}
        />
      )}
    </div>
  )
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-medium tabular">{value}</span>
    </div>
  )
}
