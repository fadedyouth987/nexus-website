import { redirect } from 'next/navigation'

/** Deduplicate: /automation/scheduling → /schedules (canonical) */
export default function AutomationSchedulingRedirectPage() {
  redirect('/schedules')
}
