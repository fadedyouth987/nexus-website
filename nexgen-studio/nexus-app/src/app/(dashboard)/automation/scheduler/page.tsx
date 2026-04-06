import { redirect } from 'next/navigation'

/** Canonical scheduling is at /schedules; redirect legacy /automation/scheduler paths */
export default function AutomationSchedulerRedirectPage() {
  redirect('/schedules')
}
