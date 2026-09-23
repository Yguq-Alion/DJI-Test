import { ArrowDown, ArrowUp } from 'lucide-react'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { useRanking } from '@/api/queries'
import type { RankingItem, RankingSort } from '@/api/types'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { Delta } from '@/components/dashboard/delta'
import { ManagerAvatar } from '@/components/dashboard/manager-avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

export function RankingCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const [sortBy, setSortBy] = useRankingSort()
  const query = useRanking(params, sortBy)
  const items = query.data?.items ?? []

  return (
    <BlockCard
      title="Рейтинг менеджеров"
      description="Место, изменение метрики и позиции к прошлому периоду"
      className={className}
      action={
        <Tabs value={sortBy} onValueChange={(value) => void setSortBy(value as RankingSort)}>
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
                <TableHead className="w-12">#</TableHead>
                <TableHead>Менеджер</TableHead>
                <TableHead className="text-right">Продажи</TableHead>
                <TableHead className="text-right">Выручка</TableHead>
                <SortableHead active={sortBy === 'grossProfit'}>Валовая прибыль</SortableHead>
                <SortableHead active={sortBy === 'averageCheck'}>Средний чек</SortableHead>
                <TableHead className="text-right">Маржа</TableHead>
                <TableHead className="text-right">Изменение</TableHead>
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

function SortableHead({ active, children }: { active: boolean; children: string }) {
  return (
    <TableHead
      className={cn('text-right', active && 'font-semibold text-foreground')}
      aria-sort={active ? 'descending' : undefined}
    >
      {children}
    </TableHead>
  )
}

function RankingRow({ item, sortBy }: { item: RankingItem; sortBy: RankingSort }) {
  const inactive = item.rank === null
  return (
    <TableRow className={cn(inactive && 'text-muted-foreground')}>
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
      <TableCell className="text-right">{inactive ? '' : <Delta change={item.change} />}</TableCell>
    </TableRow>
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
