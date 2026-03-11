import { cn } from '@/lib/core/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-md bg-muted animate-pulse', className)}
      {...props}
    />
  )
}

export { Skeleton }
