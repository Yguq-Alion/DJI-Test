import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useRanking, useRecentSales } from '@/api/queries'
import type { RecentSale, SaleStatus } from '@/api/types'
import { BlockCard, QueryState } from '@/components/dashboard/block-card'
import { ManagerAvatar } from '@/components/dashboard/manager-avatar'
import { STATUS_LABELS, StatusBadge } from '@/components/dashboard/status-badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { usePeriod } from '@/features/period/period-state'
import { useRankingSort } from '@/features/ranking/ranking-card'
import { formatDateTime, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'

const ALL = 'all'

export function RecentSalesCard({ className }: { className?: string }) {
  const { params } = usePeriod()
  const [status, setStatus] = useState<SaleStatus | undefined>()
  const [managerId, setManagerId] = useState<number | undefined>()
  const query = useRecentSales(params, { status, managerId })
  const [sortBy] = useRankingSort()
  // Список менеджеров для фильтра берём из уже загруженного рейтинга — без отдельного запроса.
  const managers = (useRanking(params, sortBy).data?.items ?? [])
    .map((i) => i.manager)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'))

  const sales = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <BlockCard
      title="Последние продажи"
      description="Продажи выбранного периода, от новых к старым"
      className={className}
      action={
        <div className="flex gap-2">
          <Select
            value={status ?? ALL}
            onValueChange={(v) => setStatus(v === ALL ? undefined : (v as SaleStatus))}
          >
            <SelectTrigger size="sm" className="w-40" aria-label="Статус">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все статусы</SelectItem>
              {(Object.keys(STATUS_LABELS) as SaleStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={managerId ? String(managerId) : ALL}
            onValueChange={(v) => setManagerId(v === ALL ? undefined : Number(v))}
          >
            <SelectTrigger size="sm" className="w-52" aria-label="Менеджер">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Все менеджеры</SelectItem>
              {managers.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <QueryState
        isPending={query.isPending}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching && !query.isFetchingNextPage}
        isEmpty={sales.length === 0}
        onRetry={() => void query.refetch()}
        skeleton={<TableSkeleton />}
        emptyText={status || managerId ? 'Нет продаж с такими фильтрами.' : 'За выбранный период продаж нет.'}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-36">Дата</TableHead>
              <TableHead>Менеджер</TableHead>
              <TableHead>Клиент</TableHead>
              <TableHead>Товары</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
              <TableHead className="text-right">Валовая прибыль</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} />
            ))}
          </TableBody>
        </Table>
        {query.hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
            >
              {query.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
              Загрузить ещё
            </Button>
          </div>
        )}
      </QueryState>
    </BlockCard>
  )
}

function SaleRow({ sale }: { sale: RecentSale }) {
  const [first, ...rest] = sale.items
  const muted = sale.status === 'cancelled'
  return (
    <TableRow className={cn(muted && 'text-muted-foreground')}>
      <TableCell className="tabular">{formatDateTime(sale.soldAt)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ManagerAvatar manager={sale.manager} size="sm" />
          <span className="truncate">{sale.manager.fullName}</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="truncate">{sale.company}</div>
        <div className="truncate text-xs text-muted-foreground">{sale.customer}</div>
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="max-w-64 cursor-default truncate">
              {first.product}
              {first.quantity > 1 && <span className="text-muted-foreground"> × {first.quantity}</span>}
              {rest.length > 0 && <span className="text-muted-foreground"> и ещё {rest.length}</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {sale.items.map((item) => (
              <div key={item.product}>
                {item.product} × {item.quantity} — {formatMoney(item.unitPrice * item.quantity)}
              </div>
            ))}
          </TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        {sale.refund ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-default">
                <StatusBadge status={sale.status} />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div>Возврат {formatDateTime(sale.refund.refundedAt)}</div>
              {sale.refund.reason && <div>{sale.refund.reason}</div>}
              <div>{sale.refund.itemsRestocked ? 'Товар вернулся на склад' : 'Товар потерян'}</div>
              {sale.refund.extraCosts > 0 && (
                <div>Расходы на возврат: {formatMoney(sale.refund.extraCosts)}</div>
              )}
            </TooltipContent>
          </Tooltip>
        ) : (
          <StatusBadge status={sale.status} />
        )}
      </TableCell>
      <TableCell className={cn('text-right tabular', muted && 'line-through')}>
        {formatMoney(sale.amount)}
      </TableCell>
      <TableCell
        className={cn('text-right tabular', muted && 'line-through', sale.grossProfit < 0 && 'text-critical')}
      >
        {formatMoney(sale.grossProfit)}
      </TableCell>
    </TableRow>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  )
}
