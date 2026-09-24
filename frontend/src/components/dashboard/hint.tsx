import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/**
 * Пояснение по наведению: подчёркнутый пунктиром элемент (заголовок, значение метрики),
 * по hover/focus показывает объяснение, как считается показатель.
 */
export function Hint({
  content,
  children,
  className,
}: {
  content: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            'w-fit cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4 outline-none transition-colors hover:decoration-foreground focus-visible:decoration-foreground',
            className,
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="block max-w-80 text-left leading-relaxed">{content}</TooltipContent>
    </Tooltip>
  )
}
