import { redirect } from 'next/navigation'

/** Canonical planner is at /planner; redirect nested automation/planner paths */
export default function AutomationPlannerRedirectPage() {
  redirect('/planner')
}
