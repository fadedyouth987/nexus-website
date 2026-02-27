'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function logEvent(action: string, targetResource: string, details: Record<string, unknown> = {}) {
  // 1. FIX: Await the cookies promise (Next.js 15 requirement)
  const cookieStore = await cookies()
  
  // 2. FIX: Await the client creation (since we made server.js async)
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // We can't log an event without a user
    return
  }

  const { error } = await supabase.from('audit_logs').insert([
    {
      actor_id: user.id,
      action,
      target_resource: targetResource,
      details,
    },
  ])

  if (error) {
    // In a real application, you might want to handle this error more gracefully
    console.error('Error logging event:', error)
  }
}