'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type FormShellProps = {
  title: string
  description: string
  submitLabel: string
  cancelHref: string
  onSubmit: () => Promise<void>
  children: ReactNode
}

export function FormShell({
  title,
  description,
  submitLabel,
  cancelHref,
  onSubmit,
  children,
}: FormShellProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await onSubmit()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-6">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {children}

          <div className="flex flex-wrap gap-3 border-t border-border/70 pt-6">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
