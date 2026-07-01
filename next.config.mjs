import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.SUPABASE_URL || "";
let remotePatterns = [];

if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      port: url.port || "",
      pathname: "/**"
    });
  } catch {
    remotePatterns = [];
  }
}

const permissionsPolicy = [
  "63616d657261",
  "6d6963726f70686f6e65",
  "67656f6c6f636174696f6e",
  "7061796d656e74",
  "757362",
  "6d61676e65746f6d65746572",
  "6779726f73636f7065",
  "616363656c65726f6d65746572"
].map(value => `${Buffer.from(value, "hex").toString("utf8")}=()`).join(", ");

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns
  },
  webpack(config) {
    config.module.rules.push({
      test: /GalaxyControlMap\.jsx$/,
      enforce: "pre",
      use: [
        {
          loader: path.join(__dirname, "scripts/galaxy-control-map-loader.cjs")
        }
      ]
    });

    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: permissionsPolicy
          }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      { source: "/index.html", destination: "/" },
      { source: "/reavers/:section.html", destination: "/reavers/:section" },
      { source: "/guards/:section.html", destination: "/guards/:section" },
      { source: "/dark-honor-guards/:section.html", destination: "/dark-honor-guards/:section" },
      { source: "/inquisitors/:section.html", destination: "/inquisitors/:section" },
      { source: "/dreads/:section.html", destination: "/dreads/:section" },
      { source: "/dread-masters/:section.html", destination: "/dread-masters/:section" },
      { source: "/instructors/:section.html", destination: "/instructors/:section" },
      { source: "/highranks/:section.html", destination: "/highranks/:section" },
      { source: "/council/:section.html", destination: "/council/:section" },
      { source: "/dark-council/:section.html", destination: "/dark-council/:section" },
      { source: "/:path*.html", destination: "/:path*" }
    ];
  }
};

export default nextConfig;
