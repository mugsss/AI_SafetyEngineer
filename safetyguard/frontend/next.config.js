/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

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
