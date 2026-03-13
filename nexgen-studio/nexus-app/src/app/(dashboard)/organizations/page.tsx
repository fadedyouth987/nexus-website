'use client'

import { useActionState, useEffect, useState } from 'react'
import { createOrganization } from '@/organizations/actions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const initialState: { error: string | null } = {
  error: null,
}

const hasSupabaseEnv =
  typeof process !== 'undefined' &&
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL
  ) &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export default function OrganizationsPage() {
  const [state, formAction] = useActionState(createOrganization, initialState)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!hasSupabaseEnv) {
        setConfigError(
          'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.local.example).'
        )
        setIsLoading(false)
        return
      }
      setIsLoading(true)
      setConfigError(null)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const { data } = await supabase
          .from('organization_members')
          .select('organizations(*)')
          .eq('user_id', user?.id)
        setOrganizations(data ?? [])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('Missing required') || msg.includes('Supabase')) {
          setConfigError(
            'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see .env.local.example).'
          )
        } else {
          setConfigError(msg)
        }
        setOrganizations([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchOrganizations()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Organizations</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold mb-4">Your Organizations</h2>
          <div className="space-y-4">
            {configError ? (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4 text-sm text-amber-800 dark:text-amber-200">
                  {configError}
                </CardContent>
              </Card>
            ) : isLoading ? (
              <p>Loading...</p>
            ) : organizations?.length > 0 ? (
              organizations.map((org: any) => (
                <Link key={org.organizations.id} href={`/organizations/${org.organizations.id}`}>
                  <Card className="hover:bg-muted">
                    <CardHeader>
                      <CardTitle>{org.organizations.name}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))
            ) : (
              <p>No organizations found.</p>
            )}
          </div>
        </div>
        <div>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create New Organization</CardTitle>
              <CardDescription>
                Create a new organization to manage your influencers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input id="name" name="name" type="text" required />
                </div>
                {state?.error && <p className="text-red-500">{state.error}</p>}
                <Button type="submit" className="w-full">
                  Create Organization
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
