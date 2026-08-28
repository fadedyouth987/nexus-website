import Link from 'next/link'
import { ArrowRight, CalendarCheck2, CreditCard, MessageSquareText, ReceiptText, UsersRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

const FLOW = [
  {
    title: 'Capture every enquiry',
    body: 'Bring new leads into one workspace so calls, messages, forms, and follow-ups do not disappear between tools.',
    icon: MessageSquareText,
  },
  {
    title: 'Convert enquiries into booked work',
    body: 'Qualify the customer, track the opportunity, schedule the job, and keep the next action obvious.',
    icon: CalendarCheck2,
  },
  {
    title: 'Quote, invoice, and get paid',
    body: 'Move from approved work to quotes, invoices, payments, and revenue attribution without rebuilding the customer record.',
    icon: ReceiptText,
  },
]

const OPERATIONS = [
  { label: 'Customers & leads', icon: UsersRound },
  { label: 'Conversations & follow-up', icon: MessageSquareText },
  { label: 'Bookings & jobs', icon: CalendarCheck2 },
  { label: 'Quotes & invoices', icon: ReceiptText },
  { label: 'Payments & subscriptions', icon: CreditCard },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main>
        <section className="border-b border-border/70 py-20 sm:py-28">
          <div className="app-page-shell grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center">
            <div className="space-y-7">
              <div className="app-section-kicker">AI revenue operations for service businesses</div>
              <div className="space-y-5">
                <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
                  Jobryn turns enquiries into booked work and paid revenue.
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                  One operating system for the path from first enquiry through customer, booking, job, quote, invoice, payment, review, and repeat business.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/auth">
                    Open Jobryn <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-muted/30 p-6 shadow-sm">
              <div className="mb-5 text-sm font-medium text-muted-foreground">Jobryn revenue flow</div>
              <div className="space-y-3">
                {OPERATIONS.map(({ label, icon: Icon }, index) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-20">
          <div className="app-page-shell space-y-10">
            <div className="max-w-2xl space-y-3">
              <div className="app-section-kicker">One customer lifecycle</div>
              <h2 className="text-3xl font-semibold tracking-tight">Less tool-hopping. Clearer next actions.</h2>
              <p className="text-muted-foreground">
                Jobryn is being built around the operational flow a service business actually needs, rather than a pile of disconnected dashboards.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {FLOW.map(({ title, body, icon: Icon }) => (
                <Card key={title}>
                  <CardHeader>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{body}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/20 py-16">
          <div className="app-page-shell grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <div className="app-section-kicker">Built for real operations</div>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight">Keep the business record connected from lead to revenue.</h2>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Workspace-based access keeps customer and operational data separated between businesses.</p>
              <p>Supabase provides the core data and authentication layer, while billing and external integrations can be connected without exposing privileged credentials to the browser.</p>
              <p>The production target for Jobryn is jobryn.org.</p>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="app-page-shell rounded-3xl border border-border p-8 text-center sm:p-12">
            <h2 className="text-3xl font-semibold tracking-tight">Build the customer journey once. Run it every day.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
              Sign in to continue setting up the Jobryn workspace and the integrations that power the workflow.
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/auth">Continue to Jobryn</Link>
            </Button>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
