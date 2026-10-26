import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Docker image runs .next/standalone/server.js (see Dockerfile).
  output: "standalone",
  // Load pg with Node's require instead of bundling it (optional native bindings).
  serverExternalPackages: ["pg"],
  // Migrations and seeds are read from disk at runtime (src/server/db/sql-root.ts),
  // which file tracing cannot see; include them in every server trace.
  outputFileTracingIncludes: {
    "/*": ["src/server/db/sql/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
