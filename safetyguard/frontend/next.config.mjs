/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/login', destination: '/dashboard', permanent: false },
      { source: '/register', destination: '/dashboard', permanent: false },
    ];
  },
  /**
   * Proxy /api/* → FastAPI so the browser can use same-origin requests when
   * NEXT_PUBLIC_API_URL is unset (axios baseURL '' in api.ts). Fixes 404s from
   * calling localhost:3000/api/* without a matching Next route.
   */
  async rewrites() {
    const backend =
      (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
