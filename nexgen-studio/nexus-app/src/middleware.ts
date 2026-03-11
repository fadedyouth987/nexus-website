import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit, getIdentifier } from "@/lib/core/rateLimit";

const PUBLIC_PATHS = new Set([
  "/auth",
  "/register",
  "/",
  "/landing",
  "/pricing",
  "/checkout",
  "/features",
  "/blog",
  "/learn",
  "/about",
  "/contact",
  "/faq",
  "/legal",
]);
const PROTECTED_PATHS = [
  "/portfolio",
  "/dashboard",
  "/creators",
  "/influencers",
  "/posts",
  "/assets",
  "/automation",
  "/calendar",
  "/studio",
  "/edit",
  "/generations",
  "/content-plans",
  "/series",
  "/agency",
  "/models",
  "/production",
  "/intelligence",
  "/settings",
  "/inbox",
  "/gallery",
  "/vault",
  "/showcase",
  "/audit-logs",
  "/admin",
];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/webhooks/", "/api/stripe/webhook"];
const authSecret = process.env.NEXTAUTH_SECRET || "your-secret-key-change-this";

function isV2Enabled() {
  const server = process.env.ENABLE_V2_PORTFOLIO;
  const client = process.env.NEXT_PUBLIC_ENABLE_V2_PORTFOLIO;
  const asBool = (value?: string) => value === "1" || value?.toLowerCase() === "true";
  return asBool(server) || asBool(client);
}

const V2_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: "/dashboard", to: "/portfolio" },
  { from: "/generations", to: "/production" },
  { from: "/models", to: "/settings/organization" },
  { from: "/assets", to: "/production?tab=library" },
  { from: "/posts", to: "/production" },
  { from: "/influencers", to: "/creators" },
];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname === "/api/auth/signin" || pathname === "/api/auth/callback/credentials") {
    const id = getIdentifier(request, null);
    const { ok } = checkRateLimit(id);
    if (!ok) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/legal/")) {
    return NextResponse.next();
  }

  const isProtectedApi =
    pathname.startsWith("/api/") &&
    !PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtectedApi) {
    const token = await getToken({ req: request, secret: authSecret });
    if (!token) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (isV2Enabled()) {
    const redirectRule = V2_REDIRECTS.find(
      (rule) => pathname === rule.from || pathname.startsWith(rule.from + "/")
    );

    if (redirectRule) {
      const targetUrl = new URL(redirectRule.to, request.url);
      return NextResponse.redirect(targetUrl);
    }
  }

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));

  if (isProtected) {
    const token = await getToken({ req: request, secret: authSecret });

    if (!token) {
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith("/dashboard/vault")) {
      if (token.vault_mode !== "nsfw") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    if (pathname === "/dashboard") {
      if (token.vault_mode === "nsfw") {
        return NextResponse.redirect(new URL("/dashboard/vault", request.url));
      }
    }
  }

  return NextResponse.next();
}
