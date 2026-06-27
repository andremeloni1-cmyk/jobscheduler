/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // googleapis / prisma / pdf-lib are server-only; keep them out of the client bundle.
    serverComponentsExternalPackages: ["googleapis", "@prisma/client", "pdf-lib"],
  },
};

export default nextConfig;
