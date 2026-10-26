// requireUser: Hono middleware that rejects requests without a valid session
// cookie and exposes the signed-in user to the handler via c.get("user") and
// c.get("userId"). The user id always comes from the session, never the request.
import { createMiddleware } from "hono/factory";
import { auth, type AuthUser } from "../auth";

export type AuthEnv = {
  Variables: {
    user: AuthUser;
    /** auth.users.id as a number. Better Auth hands ids over as strings. */
    userId: number;
  };
};

export const requireUser = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const userId = Number(session?.user.id);
  if (!session || !Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: "Not signed in", code: "unauthenticated" }, 401);
  }
  c.set("user", session.user);
  c.set("userId", userId);
  await next();
});
