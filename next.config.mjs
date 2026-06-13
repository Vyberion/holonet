import { URL } from "node:url";

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

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns
  },
  async rewrites() {
    return [
      { source: "/index.html", destination: "/" },
      { source: "/reavers/:section.html", destination: "/reavers/:section" },
      { source: "/dark-honor-guards/:section.html", destination: "/dark-honor-guards/:section" },
      { source: "/inquisitors/:section.html", destination: "/inquisitors/:section" },
      { source: "/dread-masters/:section.html", destination: "/dread-masters/:section" },
      { source: "/highranks/:section.html", destination: "/highranks/:section" },
      { source: "/dark-council/:section.html", destination: "/dark-council/:section" },
      { source: "/:path*.html", destination: "/:path*" }
    ];
  }
};

export default nextConfig;
