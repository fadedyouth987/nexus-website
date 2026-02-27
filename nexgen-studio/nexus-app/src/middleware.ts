import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_PATHS = new Set(["/auth", "/register", "/"]);
const PROTECTED_PATHS = [
  "/dashboard",
  "/creators",
  "/posts",
  "/assets",
  "/automation",
  "/calendar",
  "/studio",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow internal Next.js routes and auth API
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Public paths - allow without auth
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Check for protected paths
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    // Redirect unauthenticated users to login
    if (!token) {
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Vault-aware routing for specific paths
    // /dashboard/vault requires vault_mode='nsfw'
    if (pathname.startsWith("/dashboard/vault")) {
      if (token.vault_mode !== "nsfw") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    // /dashboard (non-vault) requires vault_mode='sfw'
    if (pathname === "/dashboard") {
      if (token.vault_mode === "nsfw") {
        return NextResponse.redirect(new URL("/dashboard/vault", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
