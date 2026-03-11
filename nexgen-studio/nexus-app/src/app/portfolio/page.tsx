'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import apiFetch from '@/lib/core/api'
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useWorkspace } from '@/context/WorkspaceContext'

type WorkspaceV2 = {
  id: string
  org_id: string
  name: string
  client_visible: boolean
  created_at: string
  role: string
}

type PortfolioResponse = {
  metrics: {
    creators: number
    content: number
    schedules: number
    views: number
    engagement: number
    revenue: number
  }
  meta: {
    org_id: string
    workspace_id: string
    workspace_name: string
    role: string
  }
}

function PortfolioV2Page() {
  const { status } = useSession()
  const router = useRouter()
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceV2[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')

  const loadAnalytics = useCallback(async (workspaceId: string) => {
    setLoading(true)
    setError(null)
    try {
      const analyticsResponse = await apiFetch(`/analytics?workspace_id=${workspaceId}`)
      if (!analyticsResponse.ok) {
        const payload = await analyticsResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load portfolio analytics')
      }

      const analyticsPayload = (await analyticsResponse.json()) as {
        metrics: PortfolioResponse['metrics']
        meta: PortfolioResponse['meta']
      }
      setPortfolio({
        metrics: analyticsPayload.metrics,
        meta: analyticsPayload.meta,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio analytics')
    } finally {
      setLoading(false)
    }
  }, [])

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const workspaceResponse = await apiFetch('/workspaces')
      if (!workspaceResponse.ok) {
        const payload = await workspaceResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load workspaces')
      }

      const workspaceRows = (await workspaceResponse.json()) as WorkspaceV2[]
      setWorkspaces(workspaceRows)

      if (workspaceRows.length > 0) {
        const preferredWorkspace =
          (currentWorkspace && workspaceRows.find((workspace) => workspace.id === currentWorkspace.id)) ||
          workspaceRows[0]
        setSelectedWorkspaceId(preferredWorkspace.id)
        setCurrentWorkspace(preferredWorkspace)
      } else {
        setPortfolio(null)
        setCurrentWorkspace(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace, setCurrentWorkspace])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void boot()
    }
  }, [status, router, boot])

  useEffect(() => {
    if (currentWorkspace?.id && currentWorkspace.id !== selectedWorkspaceId) {
      setSelectedWorkspaceId(currentWorkspace.id)
    }
  }, [currentWorkspace?.id, selectedWorkspaceId])

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadAnalytics(selectedWorkspaceId)
    }
  }, [selectedWorkspaceId, loadAnalytics])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  const activeWorkspace = portfolio?.meta?.workspace_name || workspaces[0]?.name || 'No workspace'

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Portfolio</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Organization and workspace-level health across creators, production, calendar, and performance.
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut({ redirect: true, callbackUrl: '/auth' })}>
          Sign Out
        </Button>
      </div>

      {error ? (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workspaces.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.creators || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.content || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.schedules || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.views || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(portfolio?.metrics.revenue || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Workspace</CardTitle>
            <CardDescription>Current workspace scope selected by API defaults.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="font-medium text-foreground">{activeWorkspace}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Access Context</CardTitle>
            <CardDescription>Role and tenancy context resolved server-side.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>Organization: {portfolio?.meta.org_id || 'N/A'}</div>
            <div>Workspace: {portfolio?.meta.workspace_id || 'N/A'}</div>
            <div>Role: {portfolio?.meta.role || 'N/A'}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function LegacyPortfolioFallback() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
      Redirecting to dashboard...
    </div>
  )
}

export default function PortfolioPage() {
  return isPortfolioV2ClientEnabled() ? <PortfolioV2Page /> : <LegacyPortfolioFallback />
}
