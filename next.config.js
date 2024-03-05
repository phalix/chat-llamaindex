/** @type {import('next').NextConfig} */
module.exports = {
    
    assetPrefix: './',
    experimental: {
        serverComponentsExternalPackages: ["pdf-parse", "llamaindex"],
        outputFileTracingIncludes: {
          "/*": ["./cache/**/*"],
        },
      },
      images: {
        remotePatterns: [
          {
            protocol: "https",
            hostname: "*.public.blob.vercel-storage.com",
          },
        ],
      },
  };