'use client'

import { useActionState, useEffect, useState } from 'react'
import { createInfluencer } from '@/influencers/actions'
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
import { Sidebar } from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase/client'

const initialState: { error: string | null } = {
  error: null,
}

export default function InfluencersPage({
  params,
}: {
  params: { orgId: string }
}) {
  const [state, formAction] = useActionState(createInfluencer, initialState)
  const [organization, setOrganization] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchOrganization = async () => {
      setIsLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from("organizations")
        .select("*, influencers(*)")
        .eq("id", params.orgId)
        .single()
      setOrganization(data)
      setIsLoading(false)
    }
    fetchOrganization()
  }, [params.orgId])

  return (
    <div className="flex">
      <Sidebar orgId={params.orgId} />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-8">
          {organization?.name} Influencers
        </h1>
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="space-y-4">
              {isLoading ? (
                <p>Loading...</p>
              ) : organization?.influencers.length > 0 ? (
                organization.influencers.map((influencer: any) => (
                  <Link key={influencer.id} href={`/influencers/${influencer.id}`}>
                    <Card className="hover:bg-muted">
                      <CardHeader>
                        <CardTitle>{influencer.name}</CardTitle>
                        <CardDescription>{influencer.handle}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p>{influencer.niche}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <p>No influencers found.</p>
              )}
            </div>
          </div>
          <div>
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create New Influencer</CardTitle>
                <CardDescription>
                  Create a new influencer for this organization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={formAction} className="space-y-4">
                  <input type="hidden" name="orgId" value={params.orgId} />
                  <div className="space-y-2">
                    <Label htmlFor="name">Influencer Name</Label>
                    <Input id="name" name="name" type="text" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handle">Handle</Label>
                    <Input id="handle" name="handle" type="text" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="niche">Niche</Label>
                    <Input id="niche" name="niche" type="text" required />
                  </div>
                  {state?.error && <p className="text-red-500">{state.error}</p>}
                  <Button type="submit" className="w-full">
                    Create Influencer
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
