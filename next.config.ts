/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  // Windows + 较长/中文路径下，持久化 webpack 缓存易出现 chunk 丢失（如 Cannot find module './447.js'）
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  }
};

export default nextConfig;
