import { ArrowDown, ArrowUp } from 'lucide-react'
import { motion } from 'motion/react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'
import { useRanking } from '@/api/queries'
import type { RankingItem, RankingSort } from '@/api/types'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { Delta } from '@/components/dashboard/delta'
import { ManagerAvatar } from '@/components/dashboard/manager-avatar'
import { nextSort, SortableHead, type SortState } from '@/components/dashboard/sortable-head'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePeriod } from '@/features/period/period-state'
import { formatInteger, formatMoneyCompact, formatShare } from '@/lib/format'
import { cn } from '@/lib/utils'

const SORTS = ['grossProfit', 'averageCheck'] as const satisfies readonly RankingSort[]

export function useRankingSort() {
  return useQueryState(
    'rank',
    parseAsStringLiteral(SORTS).withDefault('grossProfit').withOptions({ history: 'replace' }),
  )
}

type RankingColumn =
  'rank' | 'manager' | 'salesCount' | 'revenue' | 'grossProfit' | 'averageCheck' | 'margin' | 'change'

const DEFAULT_SORT: SortState<RankingColumn> = { key: 'rank', dir: 'asc' }

const columnValue: Record<RankingColumn, (item: RankingItem) => number | string | null> = {
  rank: (i) => i.rank,
  manager: (i) => i.manager.fullName,
  salesCount: (i) => i.salesCount,
  revenue: (i) => i.revenue,
  grossProfit: (i) => i.grossProfit,
  averageCheck: (i) => i.averageCheck,
  margin: (i) => i.margin,
  change: (i) => i.change,
}

/**
 * Пересортировка уже посчитанного сервером рейтинга (десятки строк) по выбранной колонке.
 * Пустые значения (нет продаж, нет базы для сравнения) всегда внизу.
 */
function sortItems(items: RankingItem[], sort: SortState<RankingColumn>): RankingItem[] {
  const value = columnValue[sort.key]
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...items].sort((a, b) => {
    const x = value(a)
    const y = value(b)
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    const diff = typeof x === 'string' ? x.localeCompare(String(y), 'ru') : x - Number(y)
    return diff * sign
  })
}

export function RankingCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const [sortBy, setSortBy] = useRankingSort()
  const query = useRanking(params, sortBy)
  const [sort, setSort] = useState(DEFAULT_SORT)
  const items = useMemo(() => sortItems(query.data?.items ?? [], sort), [query.data, sort])
  const onSort = (column: RankingColumn) =>
    setSort((s) => nextSort(s, column, column === 'rank' || column === 'manager' ? 'asc' : 'desc'))

  return (
    <BlockCard
      title="Рейтинг менеджеров"
      hint="Место в рейтинге считается по выбранной метрике (валовая прибыль или средний чек). Стрелка у места — сдвиг позиции, «Изменение» — рост метрики к предыдущему периоду той же длины. Клик по заголовку колонки меняет сортировку таблицы."
      className={className}
      action={
        <Tabs
          value={sortBy}
          onValueChange={(value) => {
            void setSortBy(value as RankingSort)
            setSort(DEFAULT_SORT)
          }}
        >
          <TabsList aria-label="Ранжировать по">
            <TabsTrigger value="grossProfit">Валовая прибыль</TabsTrigger>
            <TabsTrigger value="averageCheck">Средний чек</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        isEmpty={items.length === 0}
        onRetry={() => void query.refetch()}
        skeleton={<RankingSkeleton />}
        emptyText="Нет активных менеджеров"
      >
        <div className="max-h-[900px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <SortableHead column="rank" sort={sort} onSort={onSort} className="w-14">
                  #
                </SortableHead>
                <SortableHead column="manager" sort={sort} onSort={onSort}>
                  Менеджер
                </SortableHead>
                <SortableHead column="salesCount" sort={sort} onSort={onSort} align="right">
                  Продажи
                </SortableHead>
                <SortableHead column="revenue" sort={sort} onSort={onSort} align="right">
                  Выручка
                </SortableHead>
                <SortableHead column="grossProfit" sort={sort} onSort={onSort} align="right">
                  Валовая прибыль
                </SortableHead>
                <SortableHead column="averageCheck" sort={sort} onSort={onSort} align="right">
                  Средний чек
                </SortableHead>
                <SortableHead column="margin" sort={sort} onSort={onSort} align="right">
                  Маржа
                </SortableHead>
                <SortableHead column="change" sort={sort} onSort={onSort} align="right" className="w-28">
                  Изменение
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <RankingRow key={item.manager.id} item={item} sortBy={sortBy} />
              ))}
            </TableBody>
          </Table>
        </div>
      </QueryState>
    </BlockCard>
  )
}

const MotionRow = motion.create(TableRow)

function RankingRow({ item, sortBy }: { item: RankingItem; sortBy: RankingSort }) {
  const inactive = item.rank === null
  return (
    // layout: при смене режима или периода строки плавно переезжают на новые места.
    <MotionRow
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ layout: { type: 'spring', stiffness: 380, damping: 34 }, opacity: { duration: 0.2 } }}
      className={cn(inactive && 'text-muted-foreground')}
    >
      <TableCell className="tabular">
        <div className="flex items-center gap-1">
          <span
            className={cn('w-5 font-semibold', item.rank !== null && item.rank <= 3 && 'text-foreground')}
          >
            {item.rank ?? '—'}
          </span>
          <RankMove rank={item.rank} previousRank={item.previousRank} />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2.5">
          <ManagerAvatar manager={item.manager} size="sm" />
          <div className="min-w-0">
            <div className={cn('truncate font-medium', !inactive && 'text-foreground')}>
              {item.manager.fullName}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {item.manager.team}
              {!item.manager.isActive && ' · уволен'}
              {inactive && item.manager.isActive && ' · нет продаж за период'}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right tabular">{formatInteger(item.salesCount)}</TableCell>
      <TableCell className="text-right tabular">{formatMoneyCompact(item.revenue)}</TableCell>
      <TableCell
        className={cn(
          'text-right tabular',
          sortBy === 'grossProfit' && 'font-semibold',
          item.grossProfit < 0 && 'text-critical',
        )}
      >
        {formatMoneyCompact(item.grossProfit)}
      </TableCell>
      <TableCell className={cn('text-right tabular', sortBy === 'averageCheck' && 'font-semibold')}>
        {formatMoneyCompact(item.averageCheck)}
      </TableCell>
      <TableCell className="text-right tabular">{formatShare(item.margin)}</TableCell>
      <TableCell className="text-right">{inactive ? '' : <Delta change={item.change} compact />}</TableCell>
    </MotionRow>
  )
}

/** Сдвиг позиции относительно прошлого периода (↑2 — поднялся на два места). */
function RankMove({ rank, previousRank }: { rank: number | null; previousRank: number | null }) {
  if (rank === null || previousRank === null || rank === previousRank) return null
  const up = rank < previousRank
  const Icon = up ? ArrowUp : ArrowDown
  return (
    <span
      className={cn('inline-flex items-center text-[11px] tabular', up ? 'text-good' : 'text-critical')}
      title={`В прошлом периоде: ${previousRank} место`}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(previousRank - rank)}
    </span>
  )
}

function RankingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-6" />
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}
