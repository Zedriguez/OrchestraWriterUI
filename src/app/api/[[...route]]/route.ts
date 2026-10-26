// Every /api/* request goes to the Hono app in src/server (see src/server/app.ts
// and docs/backend/API.md). Next.js only hands over the Request.
import { handle } from "hono/vercel";
import { app } from "@/server/app";

// Every response depends on the session cookie or the database; nothing here may
// be prerendered or cached. Next 16 already treats GET handlers as dynamic by
// default; this makes it explicit and keeps `next build` from trying to render them.
export const dynamic = "force-dynamic";
// pg, the AWS SDK and node:crypto need Node.js, not the Edge runtime.
export const runtime = "nodejs";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
