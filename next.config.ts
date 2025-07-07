import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ✅ Tắt kiểm tra ESLint khi build trên Vercel
  eslint: {
    ignoreDuringBuilds: true,
  },

  // ✅ Tùy chọn khác nếu cần thêm sau này:
  reactStrictMode: true,
  swcMinify: true,
}

export default nextConfig
