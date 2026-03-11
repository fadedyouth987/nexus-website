import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/button'

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: { orgId: string }
  searchParams?: { connected?: string }
}) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const { data: organization } = await supabase
    .from('organizations')
    .select('id, name, stripe_customer_id')
    .eq('id', params.orgId)
    .maybeSingle()

  const connected =
    searchParams?.connected === '1' ||
    (typeof organization?.stripe_customer_id === 'string' && organization.stripe_customer_id.startsWith('cus_'))

  return (
    <div className="flex">
      <Sidebar orgId={params.orgId} />
      <main className="flex-1 p-8">
        <h1 className="mb-8 text-3xl font-bold">Organization Billing</h1>

        {connected && (
          <div className="mb-6 rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-foreground">
            Stripe customer is connected for this organization.
          </div>
        )}

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect Stripe for this organization, then manage subscriptions from the main billing settings page.
          </p>

          {connected ? (
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/settings/billing">Open subscription billing</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/pricing">View plans</Link>
              </Button>
            </div>
          ) : (
            <form action="/api/stripe/connect" method="POST">
              <input type="hidden" name="orgId" value={params.orgId} />
              <Button type="submit">Connect Stripe Customer</Button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
