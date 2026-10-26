import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection (Next 16 "proxy", formerly middleware). Only
 * checks that a Better Auth session cookie exists; every API route verifies
 * the session for real. Signed-out visitors to app pages go to /sign-in with
 * a `next` to return to; signed-in visitors to the auth pages go to /library.
 * With NEXT_PUBLIC_API_MOCK=1 there is no auth server, so nothing redirects.
 */
const PROTECTED_PREFIXES = ["/library", "/programs", "/profile", "/settings", "/projects"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_API_MOCK === "1") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const signedIn = hasSessionCookie(request);

  if (startsWithAny(pathname, PROTECTED_PREFIXES)) {
    if (signedIn) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (startsWithAny(pathname, AUTH_PAGES) && signedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // App pages only: never /api, /_next, or static files.
  matcher: ["/library/:path*", "/programs/:path*", "/profile/:path*", "/settings/:path*", "/projects/:path*", "/sign-in", "/sign-up"],
};
