/**
 * next-auth/react calls `parseUrl(process.env.NEXTAUTH_URL)` at module load.
 * An empty string is truthy enough to skip fallbacks but `new URL("")` throws (breaks Vercel build).
 */
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_URL_INTERNAL'] as const) {
  if (process.env[key] === '') {
    delete process.env[key]
  }
}

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.simpleicons.org',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.runpod.io',
      },
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
