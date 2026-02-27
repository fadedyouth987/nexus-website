'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

type GoogleSignInButtonProps = {
  label: string
}

export function GoogleSignInButton({ label }: GoogleSignInButtonProps) {
  const [error, setError] = useState<string | null>(null)

  const onGoogleSignIn = async () => {
    setError(null)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (oauthError) {
      setError(
        oauthError.message.includes('provider is not enabled')
          ? 'Google sign-in is not enabled in Supabase yet. Run scripts/configure-supabase-google-auth.sh or enable Google in Supabase dashboard.'
          : oauthError.message,
      )
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={onGoogleSignIn}>
        {label}
      </Button>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  )
}
