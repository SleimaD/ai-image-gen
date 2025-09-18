import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'image.pollinations.ai' }] },
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  }
}

export default nextConfig