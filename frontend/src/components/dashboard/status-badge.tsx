import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import type { SaleStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS: Record<SaleStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Оплачена', icon: CheckCircle2, className: 'text-good border-good/30 bg-good/5' },
  refunded: {
    label: 'Возврат',
    icon: RotateCcw,
    className: 'text-critical border-critical/30 bg-critical/5',
  },
  cancelled: { label: 'Отменена', icon: XCircle, className: 'text-muted-foreground' },
}

export const STATUS_LABELS: Record<SaleStatus, string> = {
  paid: STATUS.paid.label,
  refunded: STATUS.refunded.label,
  cancelled: STATUS.cancelled.label,
}

export function StatusBadge({ status }: { status: SaleStatus }) {
  const { label, icon: Icon, className } = STATUS[status]
  return (
    <Badge variant="outline" className={cn('gap-1 font-normal', className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </Badge>
  )
}
