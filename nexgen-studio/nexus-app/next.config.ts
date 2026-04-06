/**
 * next-auth/react calls `parseUrl(process.env.NEXTAUTH_URL)` at module load.
 * An empty string skips fallbacks but `new URL("")` throws (breaks Vercel build).
 */
for (const key of ['NEXTAUTH_URL', 'NEXTAUTH_URL_INTERNAL'] as const) {
  if (process.env[key] === '') {
    delete process.env[key]
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
