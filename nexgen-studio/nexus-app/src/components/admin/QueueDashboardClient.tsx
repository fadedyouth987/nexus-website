'use client'

import { useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  Layers,
  Clock,
  RefreshCw,
  Zap,
  Pause,
  Play,
  Shield,
  Power,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import apiFetch from '@/lib/core/api'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

type CircuitData = {
  provider: string
  state: CircuitState
  failureCount: number
  successCount: number
  totalFailures: number
  totalSuccesses: number
  lastFailureAgo: string
}

type QueueData = {
  queues: {
    generations: {
      nsfw: { image: number; video: number }
      sfw: { image: number; video: number }
      total: number
    }
    videoJobs: number
  }
  stuckJobs: Array<{
    id: string
    status: string
    mode: string
    content_policy: string
    created_at: string
    updated_at: string
    error: string | null
  }>
  stats?: {
    last24h: {
      total: number
      queued: number
      generating: number
      completed: number
      failed: number
      cancelled: number
    }
  }
  throughput?: {
    jobsPerHour: number
    avgProcessingTimeSeconds: number | null
  }
  timestamp: string
}

export function QueueDashboardClient({
  initialData,
}: {
  initialData: QueueData
}) {
  const [data, setData] = useState<QueueData>(initialData)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Circuit breaker state
  const [circuits, setCircuits] = useState<CircuitData[]>([])
  const [circuitLoading, setCircuitLoading] = useState(false)
  const [circuitError, setCircuitError] = useState<string | null>(null)
  const [resettingCircuit, setResettingCircuit] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    try {
      const response = await apiFetch('/admin/queue')
      if (response.ok) {
        const freshData = await response.json()
        setData(freshData)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch queue data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCircuitData() {
    setCircuitLoading(true)
    setCircuitError(null)
    try {
      const response = await apiFetch('/admin/circuit-breaker')
      if (response.ok) {
        const freshData = await response.json()
        setCircuits(freshData.circuits || [])
      } else {
        const error = await response.json()
        setCircuitError(error.detail || 'Failed to fetch circuit status')
      }
    } catch (error) {
      console.error('Failed to fetch circuit data:', error)
      setCircuitError('Failed to fetch circuit status')
    } finally {
      setCircuitLoading(false)
    }
  }

  async function resetCircuitProvider(provider: string) {
    setResettingCircuit(provider)
    setCircuitError(null)
    try {
      const response = await apiFetch('/admin/circuit-breaker', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      })

      if (!response.ok) {
        const error = await response.json()
        setCircuitError(error.detail || 'Failed to reset circuit')
        return
      }

      // Refresh circuit data after reset
      await fetchCircuitData()
    } catch (error) {
      console.error('Failed to reset circuit:', error)
      setCircuitError('Failed to reset circuit')
    } finally {
      setResettingCircuit(null)
    }
  }

  // Auto-refresh every 10 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchData()
    }, 10000)

    return () => clearInterval(interval)
  }, [autoRefresh])

  // Fetch circuit data on mount
  useEffect(() => {
    fetchCircuitData()
  }, [])

  const generations = data.queues.generations
  const totalStuck = data.stuckJobs.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Queue Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring and job management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            {autoRefresh ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {autoRefresh ? 'Pause' : 'Auto-refresh'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Last updated: {lastUpdate.toLocaleTimeString()}
        {autoRefresh && ' · Auto-refreshing every 10s'}
      </p>

      {/* Queue Depth Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QueueCard
          title="Generation Queue"
          value={generations.total}
          subtitle="Total waiting"
          icon={<Layers className="h-4 w-4" />}
          color="blue"
        />
        <QueueCard
          title="Video Jobs"
          value={data.queues.videoJobs}
          subtitle="Campaign jobs waiting"
          icon={<Activity className="h-4 w-4" />}
          color="purple"
        />
        <QueueCard
          title="Stuck Jobs"
          value={totalStuck}
          subtitle="Require attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          color={totalStuck > 0 ? 'red' : 'green'}
          alert={totalStuck > 10}
        />
        <QueueCard
          title="Throughput"
          value={data.throughput?.jobsPerHour || 0}
          subtitle="Jobs/hour (last 60min)"
          icon={<Zap className="h-4 w-4" />}
          color="amber"
        />
      </div>

      {/* Queue Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Queue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                SFW (Safe For Work)
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Image</span>
                <Badge variant="secondary">{generations.sfw.image}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Video</span>
                <Badge variant="secondary">{generations.sfw.video}</Badge>
              </div>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                NSFW (Explicit)
              </h4>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Image</span>
                <Badge variant="secondary">{generations.nsfw.image}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Video</span>
                <Badge variant="secondary">{generations.nsfw.video}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      {data.stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">24-Hour Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <StatItem label="Total" value={data.stats.last24h.total} />
              <StatItem label="Queued" value={data.stats.last24h.queued} color="amber" />
              <StatItem label="Running" value={data.stats.last24h.generating} color="blue" />
              <StatItem label="Completed" value={data.stats.last24h.completed} color="green" />
              <StatItem label="Failed" value={data.stats.last24h.failed} color="red" />
              <StatItem label="Cancelled" value={data.stats.last24h.cancelled} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck Jobs Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stuck Jobs
              {totalStuck > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {totalStuck}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {totalStuck === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No stuck jobs detected. All jobs are processing normally.
            </p>
          ) : (
            <div className="space-y-2">
              {data.stuckJobs.slice(0, 10).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{job.id.slice(0, 12)}...</div>
                    <div className="text-xs text-muted-foreground">
                      {job.mode} · {job.content_policy} · {new Date(job.updated_at).toLocaleString()}
                    </div>
                    {job.error && (
                      <div className="text-xs text-red-600">{job.error}</div>
                    )}
                  </div>
                  <Badge
                    variant={job.status === 'GENERATING' ? 'default' : 'secondary'}
                  >
                    {job.status}
                  </Badge>
                </div>
              ))}
              {totalStuck > 10 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{totalStuck - 10} more stuck jobs
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Circuit Breaker Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Circuit Breaker Status
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCircuitData}
              disabled={circuitLoading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${circuitLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {circuitError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {circuitError}
              </div>
            </div>
          )}

          {circuits.length === 0 ? (
            <div className="text-center py-8">
              <Power className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground mt-2">
                {circuitLoading
                  ? 'Loading circuit breaker status...'
                  : 'No circuit breaker data available. Providers may not have been initialized yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {circuits.map((circuit) => (
                <CircuitBreakerRow
                  key={circuit.provider}
                  circuit={circuit}
                  onReset={() => resetCircuitProvider(circuit.provider)}
                  isResetting={resettingCircuit === circuit.provider}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CircuitBreakerRow({
  circuit,
  onReset,
  isResetting,
}: {
  circuit: CircuitData
  onReset: () => void
  isResetting: boolean
}) {
  const stateColors = {
    CLOSED: 'bg-green-500/10 text-green-600 border-green-500/20',
    OPEN: 'bg-red-500/10 text-red-600 border-red-500/20',
    HALF_OPEN: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  }

  const stateLabels = {
    CLOSED: 'Healthy',
    OPEN: 'Open (Failing)',
    HALF_OPEN: 'Testing',
  }

  const [backend, mode, policy] = circuit.provider.split(':')

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium capitalize">
            {backend} · {mode} · {policy}
          </span>
          <Badge
            variant="outline"
            className={`${stateColors[circuit.state]} border`}
          >
            {stateLabels[circuit.state]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>Failures: {circuit.failureCount}</span>
          <span>Last: {circuit.lastFailureAgo}</span>
          <span>Total: {circuit.totalFailures} fails / {circuit.totalSuccesses} OK</span>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onReset}
        disabled={isResetting || circuit.state === 'CLOSED'}
        className="gap-2 shrink-0"
      >
        {isResetting ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="h-4 w-4" />
        )}
        Reset Circuit
      </Button>
    </div>
  )
}

function QueueCard({
  title,
  value,
  subtitle,
  icon,
  color,
  alert,
}: {
  title: string
  value: number
  subtitle: string
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'red' | 'green' | 'amber'
  alert?: boolean
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    red: 'bg-red-500/10 text-red-600 border-red-500/20',
    green: 'bg-green-500/10 text-green-600 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  }

  return (
    <Card className={alert ? 'border-red-500/50' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`rounded-full border p-2 ${colorClasses[color]}`}>{icon}</div>
          {alert && <AlertTriangle className="h-4 w-4 text-red-500" />}
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold tabular-nums">{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{title}</div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  )
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: 'amber' | 'blue' | 'green' | 'red'
}) {
  const colorClasses = {
    amber: 'text-amber-600',
    blue: 'text-blue-600',
    green: 'text-green-600',
    red: 'text-red-600',
  }

  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${color ? colorClasses[color] : ''}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
