/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow reading files outside the app directory (project repos)
  serverExternalPackages: ['glob', 'gray-matter'],
}

module.exports = nextConfig
