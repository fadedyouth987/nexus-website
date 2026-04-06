import { redirect } from 'next/navigation'

/** Canonical publishing is at /schedules; redirect legacy /posts paths */
export default function PostsPage() {
  redirect('/schedules')
}
