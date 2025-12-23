/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['edudashpro.org.za', 'soilofafrica.org'],
    unoptimized: true, // Allow local images without optimization issues
  },
};

module.exports = nextConfig;
