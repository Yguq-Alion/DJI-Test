import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ChangeKind } from '@/api/types'
import { formatChange } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DeltaProps {
  change: number | null
  kind?: ChangeKind
  /** Для метрик, где рост — плохо (доля возвратов). */
  invert?: boolean
  /** В таблицах вместо фразы показывается «—» с подсказкой. */
  compact?: boolean
  className?: string
}

/** Изменение к прошлому периоду: знак, стрелка и цвет — смысл не передаётся одним цветом. */
export function Delta({ change, kind = 'percent', invert = false, compact = false, className }: DeltaProps) {
  if (change === null && compact) {
    return (
      <span
        className={cn('text-xs text-muted-foreground', className)}
        title="В прошлом периоде не было данных для сравнения"
      >
        —
      </span>
    )
  }
  if (change === null) {
    return <span className={cn('text-xs text-muted-foreground', className)}>нет данных для сравнения</span>
  }

  const good = invert ? change < 0 : change > 0
  const Icon = change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium tabular',
        change === 0 ? 'text-muted-foreground' : good ? 'text-good' : 'text-critical',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatChange(change, kind)}
    </span>
  )
}
