import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { SortDirection } from '@/api/types'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface SortState<K extends string> {
  key: K
  dir: SortDirection
}

/**
 * Следующее состояние сортировки по клику на колонку: повторный клик меняет направление,
 * новая колонка начинается с «естественного» направления (числа — по убыванию, текст — по возрастанию).
 */
export function nextSort<K extends string>(
  current: SortState<K>,
  key: K,
  firstDir: SortDirection,
): SortState<K> {
  if (current.key !== key) return { key, dir: firstDir }
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}

interface SortableHeadProps<K extends string> {
  column: K
  sort: SortState<K>
  onSort: (column: K) => void
  align?: 'left' | 'right'
  className?: string
  children: string
}

/** Заголовок колонки-кнопка: стрелка показывает текущее направление, у неактивных — приглушённый значок. */
export function SortableHead<K extends string>({
  column,
  sort,
  onSort,
  align = 'left',
  className,
  children,
}: SortableHeadProps<K>) {
  const active = sort.key === column
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={cn(align === 'right' && 'text-right', className)}
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'group/sort relative inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50',
          align === 'right' && 'flex-row-reverse',
          active ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {children}
        {/* У неактивной колонки значок появляется при наведении и не занимает места в узких таблицах. */}
        <Icon
          className={cn(
            'size-3.5 shrink-0',
            !active &&
              'absolute opacity-0 transition-opacity group-hover/sort:opacity-50 group-focus-visible/sort:opacity-50',
            !active && (align === 'right' ? '-left-4' : '-right-4'),
          )}
          aria-hidden
        />
      </button>
    </TableHead>
  )
}
