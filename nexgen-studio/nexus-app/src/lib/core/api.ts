'use client'

import { getSession, signOut } from 'next-auth/react'

const API_PREFIX = '/api'

async function apiFetch(path: string, options: RequestInit = {}) {
  const publicPaths = ['/auth/login', '/auth/register']
  const isPublicPath = publicPaths.some((publicPath) => path.startsWith(publicPath))

  let token = null
  if (!isPublicPath) {
    const session = await getSession()
    token = session?.user?.accessToken
  }

  const headers = new Headers(options.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && !isPublicPath) {
    await signOut({ callbackUrl: '/auth?error=Session+Expired' })
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return response
}

export default apiFetch
