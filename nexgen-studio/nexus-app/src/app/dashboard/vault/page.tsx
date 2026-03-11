'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VaultModeToggle } from '@/components/vault/VaultModeToggle'
import Link from 'next/link'
import { AlertCircle, Lock } from 'lucide-react'

export default function NSFWDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect SFW users to regular dashboard
  useEffect(() => {
    if (session && session.vault_mode !== 'nsfw') {
      router.push('/dashboard')
    }
  }, [session, router])

  if (status === 'loading') {
    return <div className="flex items-center justify-center h-screen">Loading...</div>
  }

  if (!session) {
    router.push('/auth')
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  const user = session.user
  const firstName = user?.name?.split(' ')[0] || 'Creator'

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900 border-b border-red-900/30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-500" />
              <h1 className="text-2xl font-bold text-white">NSFW Vault</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Restricted adult content - secure management</p>
          </div>
          <div className="flex items-center gap-4">
            <VaultModeToggle />
            <Button
              variant="outline"
              onClick={() => signOut({ redirect: true, callbackUrl: '/auth' })}
              className="border-border text-foreground hover:bg-muted"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Vault Warning */}
        <div className="mb-8 bg-red-950/30 border border-red-900/50 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-400">NSFW Content Mode</h3>
            <p className="text-sm text-red-300/80 mt-1">
              You are currently managing adult content. Ensure all content complies with platform policies for restricted channels (Fanvue, OnlyFans, etc).
            </p>
          </div>
        </div>

        {/* Welcome Section */}
        <Card className="mb-8 bg-slate-800 border-border">
          <CardHeader>
            <CardTitle className="text-white">Welcome back, {firstName}!</CardTitle>
            <CardDescription className="text-muted-foreground">
              You&apos;re in NSFW Vault mode. Adult creators and restricted content only.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Creators */}
          <Card className="bg-slate-800 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Total Creators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">0</div>
              <p className="text-xs text-muted-foreground mt-1">+0 this month</p>
            </CardContent>
          </Card>

          {/* Scheduled Posts */}
          <Card className="bg-slate-800 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Scheduled Posts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">0</div>
              <p className="text-xs text-muted-foreground mt-1">Next post in 2 days</p>
            </CardContent>
          </Card>

          {/* Total Earnings */}
          <Card className="bg-slate-800 border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">$0</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Button size="lg" className="h-12 bg-red-700 hover:bg-red-800">
            <Link href="/influencers/create">Create New Creator (Vault)</Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 border-border text-foreground hover:bg-muted">
            <Link href="/calendar">View Calendar</Link>
          </Button>
        </div>

        {/* Recent Activity */}
        <Card className="bg-slate-800 border-border">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-muted-foreground">Your latest actions and updates in the vault</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No activity yet. Create a creator to get started!</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
