'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#0a0a0a', color: '#fafafa' }}>
        <div style={{ maxWidth: '28rem', margin: '0 auto' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#a1a1aa' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #3f3f46',
                borderRadius: '0.375rem',
                color: '#fafafa',
                textDecoration: 'none',
                fontSize: '0.875rem',
              }}
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
