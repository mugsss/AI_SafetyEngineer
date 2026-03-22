/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/', destination: '/dashboard', permanent: false },
      { source: '/login', destination: '/dashboard', permanent: false },
      { source: '/register', destination: '/dashboard', permanent: false },
    ];
  },
};

export default nextConfig;
