/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  // Static export for Cloudflare Pages
  output: 'export',
  distDir: 'dist',
  // Images must be unoptimized for static export
  images: {
    unoptimized: true,
  },
  // trailingSlash for better static hosting compatibility
  trailingSlash: true,
}

export default nextConfig
