/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ththqqlecswmmyfqdyls.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com', // nếu dùng fallback avatar online
      },
    ],
  },
}

module.exports = nextConfig