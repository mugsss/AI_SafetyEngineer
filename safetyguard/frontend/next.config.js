/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Output standalone for optimized production builds
  output: 'standalone',

  // Environment variables that should be available at build time
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Configure allowed image domains if needed
  images: {
    domains: [],
    unoptimized: false,
  },

  // Webpack configuration
  webpack: (config) => {
    // Handle node modules that may not work in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
