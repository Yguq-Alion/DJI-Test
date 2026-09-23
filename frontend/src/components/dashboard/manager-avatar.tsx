import type { Manager } from '@/api/types'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ManagerAvatar({
  manager,
  size = 'md',
}: {
  manager: Pick<Manager, 'fullName' | 'avatarColor'>
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' && 'size-6 text-[10px]',
        size === 'md' && 'size-8 text-xs',
        size === 'lg' && 'size-10 text-sm',
      )}
      style={{ backgroundColor: manager.avatarColor }}
    >
      {initials(manager.fullName)}
    </span>
  )
}
