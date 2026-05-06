import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ksa.ee",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/antshaavel22/ksa-blog/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/flow3-laserkorrektsiooni-lahendus-frustreeritud-prillikandjaile",
        destination: "/miks-59-protsenti-prillikandjaid-on-frustreeritud-2",
        permanent: true,
      },
      {
        source: "/flow3-laserkorrektsiooni-eelis-100-paeeva-aastas-tagasi",
        destination: "/100-paeva-sinu-elust-prillide-varjatud-ajamaks-2",
        permanent: true,
      },
    ];
  },
  // Allow blog.ksa.ee as trusted host
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
