import { CreditCard } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function BillingPage() {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
          <CreditCard className="h-3.5 w-3.5" />
          Billing
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Billing is separated as a product domain, while legacy billing screens remain intact.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          The new information architecture exposes billing directly in product navigation. Existing billing logic still lives in the settings area until subscription and usage modules are fully migrated.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/settings/billing">Open billing settings</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
