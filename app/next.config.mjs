/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // googleapis / prisma / pdf-lib are server-only; keep them out of the client bundle.
  serverExternalPackages: ["googleapis", "@prisma/client", "pdf-lib", "@anthropic-ai/sdk"],
};

export default nextConfig;
