/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    loader: "custom",
    path: "https://robohash.org/",
  },
};

module.exports = nextConfig;
