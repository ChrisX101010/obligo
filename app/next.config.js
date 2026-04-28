/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false, os: false, crypto: false, 'pino-pretty': false };
    return config;
  },
};

module.exports = nextConfig;
