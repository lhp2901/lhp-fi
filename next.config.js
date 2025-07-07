/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ Tắt ESLint khi build trên Vercel
  },
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
