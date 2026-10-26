// Where the .sql files live at runtime.
//
//   tsx (CLI scripts, vitest)      next to this module: src/server/db/sql
//   next dev                       the same, through the project root (cwd)
//   standalone image (server.js)   <app>/src/server/db/sql, copied by the Dockerfile
//                                  and listed in outputFileTracingIncludes
//
// The module-relative path is tried first; bundlers may rewrite import.meta.url,
// so the cwd-relative path is the fallback.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function moduleDir(): string | null {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return null;
  }
}

export function sqlRoot(): string {
  const dir = moduleDir();
  const candidates = [
    ...(dir ? [path.join(dir, "sql")] : []),
    path.join(process.cwd(), "src", "server", "db", "sql"),
  ];
  return candidates.find((c) => existsSync(path.join(c, "schema"))) ?? candidates[candidates.length - 1]!;
}
