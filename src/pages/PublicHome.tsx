import React from 'react';
import { ArrowRight, Bot, CalendarCheck, Check, MessageSquareText, PhoneMissed, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { AppLink } from '../app/router';

const featureCards = [
  { icon: PhoneMissed, title: 'Recover missed calls', body: 'Automatically text missed callers, qualify the job and offer an available booking while you are still on the tools.' },
  { icon: MessageSquareText, title: 'One customer conversation', body: 'Web chat, SMS, email and phone history attach to the same customer and lead record.' },
  { icon: CalendarCheck, title: 'Turn demand into booked work', body: 'Check service area and availability, create the Jobryn booking, then sync external calendars.' },
  { icon: Bot, title: 'Controlled AI Operator', body: 'AI can use approved business tools without getting unrestricted database, payment or infrastructure access.' },
  { icon: TrendingUp, title: 'Measure the money', body: 'Connect source → lead → booking → job → payment so the owner can see exactly what Jobryn helped generate.' },
  { icon: ShieldCheck, title: 'Built for private business data', body: 'Workspace isolation, RLS, server-side authorization, signed webhooks, audit logs and least-privilege integrations.' },
];

export default function PublicHome() {
  return <div className="min-h-screen bg-[#f8fafc] text-slate-950">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
        <AppLink href="/" className="flex items-center gap-2 font-black tracking-tight"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">J</span><span className="text-lg">JOBRYN</span></AppLink>
        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"><a href="#product">Product</a><a href="#security">Security</a><AppLink href="/pricing">Pricing</AppLink></nav>
        <div className="flex items-center gap-2"><AppLink href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Log in</AppLink><AppLink href="/signup" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Start free</AppLink></div>
      </div>
    </header>

    <main>
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,.14),transparent_45%),radial-gradient(circle_at_top_right,rgba(16,185,129,.10),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:py-28">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"><Sparkles className="h-3.5 w-3.5"/> AI Revenue Operating System</div>
            <h1 className="max-w-4xl text-5xl font-black leading-[.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">Turn enquiries into <span className="text-indigo-600">booked, paid work.</span></h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">Jobryn helps service businesses respond to demand, qualify customers, book work, follow up quotes, collect revenue and bring customers back — from one operating system.</p>
            <div className="mt-8 flex flex-wrap gap-3"><AppLink href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Start building revenue <ArrowRight className="h-4 w-4"/></AppLink><AppLink href="/pricing" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">View pricing</AppLink></div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-slate-500">{['Australian service businesses','14-day trial ready','Stripe-secured billing','Cancel in portal'].map(item=><span key={item} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600"/>{item}</span>)}</div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-3 shadow-2xl shadow-slate-900/15">
            <div className="rounded-[22px] bg-white p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Today</p><h3 className="mt-1 text-xl font-bold">Revenue recovery</h3></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Operator active</span></div>
              <div className="grid grid-cols-2 gap-3 py-5"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Missed calls recovered</p><p className="mt-1 text-3xl font-black">27</p></div><div className="rounded-2xl bg-indigo-50 p-4"><p className="text-xs text-indigo-600">Attributed revenue</p><p className="mt-1 text-3xl font-black text-indigo-700">$24.8k</p></div></div>
              <div className="space-y-3">{[
                ['5:12 pm','Missed call','Auto-SMS sent'],
                ['5:14 pm','Blocked drain','Lead qualified'],
                ['5:16 pm','Wednesday 10:00','Booking accepted'],
                ['5:16 pm','$440 expected','Revenue attributed'],
              ].map(([time,title,status])=><div key={time+title} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="w-16 text-xs font-medium text-slate-400">{time}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-slate-500">{status}</p></div><span className="h-2 w-2 rounded-full bg-emerald-500"/></div>)}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[.18em] text-indigo-600">One revenue loop</p><h2 className="mt-3 text-4xl font-black tracking-tight">Acquire → Convert → Retain → Measure.</h2><p className="mt-4 text-slate-600">The CRM, inbox, booking engine, work management, payments, automations and follow-ups share one customer and revenue record.</p></div><div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{featureCards.map(({icon:Icon,title,body})=><div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon className="h-5 w-5"/></div><h3 className="font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{body}</p></div>)}</div></section>

      <section id="security" className="border-y border-slate-200 bg-slate-950 text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8"><div><p className="text-sm font-bold uppercase tracking-[.18em] text-indigo-300">Security by architecture</p><h2 className="mt-3 text-4xl font-black">Private business data should stay private.</h2><p className="mt-5 max-w-xl leading-7 text-slate-300">Every operational record belongs to a workspace. Jobryn verifies identity, workspace membership and role server-side and backs that with PostgreSQL Row Level Security.</p></div><div className="grid gap-3 sm:grid-cols-2">{['PKCE authentication','Google / GitHub / Microsoft','TOTP MFA','Row Level Security','Signed Stripe webhooks','Strict API validation','Rate limiting','Append-only audit history'].map(item=><div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200"><Check className="mr-2 inline h-4 w-4 text-emerald-400"/>{item}</div>)}</div></div></section>
    </main>

    <footer className="bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><span>© 2026 Jobryn. AI Revenue Operating System.</span><div className="flex gap-5"><AppLink href="/pricing">Pricing</AppLink><AppLink href="/login">Login</AppLink></div></div></footer>
  </div>;
}
