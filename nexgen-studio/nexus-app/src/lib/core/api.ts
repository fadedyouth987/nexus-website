/**
 * Browser / client fetch helper: calls Next.js Route Handlers under `/api`.
 * Honors NEXT_PUBLIC_API_URL when set (e.g. split deploy); otherwise same-origin.
 */
export default async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const apiPath = normalized.startsWith('/api') ? normalized : `/api${normalized}`

  const isBrowser = typeof window !== 'undefined'
  const base = isBrowser
    ? (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '')
    : (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  const url = base ? `${base}${apiPath}` : apiPath

  const headers = new Headers(init?.headers)
  if (init?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })
}
