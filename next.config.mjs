/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["sharp"],
  // Lets a check build run next to `npm run dev` without overwriting its files: NEXT_DIST_DIR=.next-check npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
};
export default nextConfig;
