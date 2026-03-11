'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Loader2, Sparkles, UserPlus, Calendar, Share2, ImageIcon, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import apiFetch from '@/lib/core/api'

type ChecklistItem = {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  completed: boolean
  loading: boolean
}

type UserProgress = {
  hasCreator: boolean
  hasContent: boolean
  hasPlan: boolean
  hasSocialAccounts: boolean
  hasScheduledPosts: boolean
}

export function GettingStartedChecklist() {
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await apiFetch('/me/progress')
        if (response.ok) {
          const data = await response.json()
          setProgress(data)
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error)
      } finally {
        setLoading(false)
      }
    }

    void fetchProgress()
  }, [])

  if (loading) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your progress...
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  // Default to empty progress if not loaded
  const p = progress || {
    hasCreator: false,
    hasContent: false,
    hasPlan: false,
    hasSocialAccounts: false,
    hasScheduledPosts: false,
  }

  const items: ChecklistItem[] = [
    {
      id: 'creator',
      label: 'Create your first creator',
      description: 'Set up an AI influencer persona with name, niche, and style',
      icon: UserPlus,
      href: '/creators/create',
      completed: p.hasCreator,
      loading: false,
    },
    {
      id: 'content',
      label: 'Generate your first content',
      description: 'Create images or videos in Studio for your creator',
      icon: ImageIcon,
      href: '/studio',
      completed: p.hasContent,
      loading: false,
    },
    {
      id: 'plan',
      label: 'Build a content plan',
      description: 'Generate a 30-day strategy and content calendar',
      icon: Calendar,
      href: '/automation/planner',
      completed: p.hasPlan,
      loading: false,
    },
    {
      id: 'social',
      label: 'Connect social accounts',
      description: 'Link your platforms for automated publishing',
      icon: Share2,
      href: '/dashboard/social',
      completed: p.hasSocialAccounts,
      loading: false,
    },
    {
      id: 'schedule',
      label: 'Schedule your first post',
      description: 'Queue content to publish automatically',
      icon: Sparkles,
      href: '/automation/scheduler',
      completed: p.hasScheduledPosts,
      loading: false,
    },
  ]

  const completedCount = items.filter((item) => item.completed).length
  const completionPercentage = Math.round((completedCount / items.length) * 100)

  // Find the first incomplete item as the "best next step"
  const nextStep = items.find((item) => !item.completed)

  // If all complete, show a celebratory state
  const allComplete = completedCount === items.length

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">
              {allComplete ? 'Setup complete!' : 'Getting started'}
            </CardTitle>
            <CardDescription className="mt-1">
              {allComplete
                ? 'You have unlocked the full automation suite.'
                : `Complete ${items.length - completedCount} more step${items.length - completedCount === 1 ? '' : 's'} to unlock automation.`}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{completedCount}/{items.length}</div>
            <div className="text-xs text-muted-foreground">completed</div>
          </div>
        </div>
        <Progress value={completionPercentage} className="mt-3 h-2" />
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Best Next Step Highlight */}
        {nextStep && (
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Best next step
            </div>
            <div className="mt-2 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <nextStep.icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">{nextStep.label}</h4>
                <p className="mt-0.5 text-sm text-muted-foreground">{nextStep.description}</p>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link href={nextStep.href}>
                  Start
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* All Steps List */}
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                item.completed
                  ? 'border-border/50 bg-muted/30'
                  : item.id === nextStep?.id
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border hover:bg-muted/50'
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  item.completed
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : item.id === nextStep?.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <item.icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1">
                <div
                  className={`text-sm font-medium ${
                    item.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                  }`}
                >
                  {item.label}
                </div>
              </div>
              {item.completed ? (
                <span className="text-xs font-medium text-emerald-600">Done</span>
              ) : item.id === nextStep?.id ? (
                <span className="text-xs font-medium text-primary">Next</span>
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>

        {/* All Complete State */}
        {allComplete && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:bg-emerald-950/20">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <h4 className="mt-2 font-semibold text-emerald-900 dark:text-emerald-400">
              You are all set!
            </h4>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-500">
              Your automation pipeline is ready. Head to the factory to create more creators or explore advanced features.
            </p>
            <Button asChild className="mt-3" variant="outline">
              <Link href="/automation/factory">Open AI Factory</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
