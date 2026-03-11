'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'

const defaultCallbackUrl = isPortfolioV2ClientEnabled() ? '/portfolio' : '/dashboard'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const callbackUrl = searchParams.get('callbackUrl') || defaultCallbackUrl

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl,
    })

    if (result?.error) {
      setError(
        result.error === 'Configuration'
          ? 'Supabase is not configured. Add your Supabase env vars to .env.local.'
          : result.error === 'Email not confirmed'
            ? 'Check your inbox and confirm your email before logging in.'
          : result.error === 'CredentialsSignin'
            ? 'Invalid email or password.'
            : result.error
      )
      setLoading(false)
      return
    }

    if (result?.url) {
      router.push(result.url)
      return
    }

    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          placeholder="m@example.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password" 
          type="password" 
          minLength={8} 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </Button>
    </form>
  )
}

function SignupForm() {
  const searchParams = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const callbackUrl = searchParams.get('callbackUrl') || defaultCallbackUrl

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    // Register first
    const registerRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    
    if (!registerRes.ok) {
      const err = await registerRes.json().catch(() => ({}))
      setError(err.detail || 'Registration failed')
      setLoading(false)
      return
    }

    const registerData = await registerRes.json().catch(() => ({}))

    if (registerData.requiresEmailConfirmation) {
      setError('Account created. Check your inbox and confirm your email before logging in.')
      setLoading(false)
      return
    }
    
    // Then sign in
    const result = await signIn('credentials', { 
      email, 
      password, 
      redirect: false, 
      callbackUrl
    })
    
    if (result?.error) {
      setError('Registration succeeded but login failed. Try logging in manually.')
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input 
          id="name" 
          type="text" 
          placeholder="Your Name" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-signup">Email</Label>
        <Input 
          id="email-signup" 
          type="email" 
          placeholder="m@example.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-signup">Password</Label>
        <Input 
          id="password-signup" 
          type="password" 
          minLength={8} 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required 
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign Up'}
      </Button>
    </form>
  )
}

function AuthPageContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const authError =
    error === 'Configuration'
      ? 'Supabase is not configured. Add your Supabase env vars to .env.local.'
      : error
        ? 'Authentication failed. Check your credentials and configuration.'
        : ''

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>AI Influencer Nexus</CardTitle>
          <CardDescription>Login or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {authError && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {authError}
            </div>
          )}
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <div className="pt-4">
                <LoginForm />
              </div>
            </TabsContent>
            <TabsContent value="signup">
              <div className="pt-4">
                <SignupForm />
              </div>
            </TabsContent>
          </Tabs>
          <div className="my-4 text-center text-xs text-muted-foreground">or</div>
          <GoogleSignInButton label="Continue with Google" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  )
}
