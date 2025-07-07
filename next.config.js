/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // 💥 TẮT eslint trong build Vercel
  },
};

module.exports = nextConfig;