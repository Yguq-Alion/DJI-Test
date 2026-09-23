import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface BlockCardProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

export function BlockCard({
  title,
  description,
  action,
  className,
  contentClassName,
  children,
}: BlockCardProps) {
  return (
    <Card className={cn('gap-4', className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className={cn('flex-1', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

interface QueryStateProps {
  isPending: boolean
  isError: boolean
  error: Error | null
  isEmpty: boolean
  isFetching?: boolean
  onRetry: () => void
  skeleton: ReactNode
  emptyText?: string
  children: ReactNode
}

/**
 * Единая обработка состояний блока: первичная загрузка → скелетон, ошибка → сообщение с повтором,
 * пусто → объяснение. При смене периода показываются прежние данные в приглушённом виде.
 */
export function QueryState(props: QueryStateProps) {
  const { isPending, isError, error, isEmpty, isFetching, onRetry, skeleton, emptyText, children } = props

  if (isPending) return <div aria-busy="true">{skeleton}</div>
  if (isError) return <ErrorState message={error?.message} onRetry={onRetry} />
  if (isEmpty) return <EmptyState text={emptyText ?? 'За выбранный период данных нет.'} />

  return (
    <div
      aria-busy={isFetching}
      className={cn('transition-opacity duration-300', isFetching && 'pointer-events-none opacity-60')}
    >
      {children}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex h-full min-h-32 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="size-5 text-critical" aria-hidden />
      <div className="max-w-sm text-sm text-muted-foreground">
        {message ?? 'Не удалось загрузить данные.'}
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCw aria-hidden /> Повторить
      </Button>
    </div>
  )
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
      <Inbox className="size-5" aria-hidden />
      {text}
    </div>
  )
}
