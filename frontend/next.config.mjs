const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1',
    NEXT_PUBLIC_NEWS_LIMIT: process.env.NEXT_PUBLIC_NEWS_LIMIT || '5',
  },
}

export default nextConfig
