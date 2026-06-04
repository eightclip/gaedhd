import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth

  // Public paths that don't require a login session. These token-gated API routes
  // enforce their own auth in the route (token for devices/bot, or session for the app),
  // so the middleware must let them through instead of bouncing to /login.
  const isPublicPath =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/now') ||
    req.nextUrl.pathname.startsWith('/api/calendar') ||
    req.nextUrl.pathname.startsWith('/api/here') ||
    req.nextUrl.pathname.startsWith('/api/inbox') ||
    // The office TV kiosk is token-gated in the page/endpoint, not by session.
    req.nextUrl.pathname.startsWith('/kiosk')

  if (!isLoggedIn && !isPublicPath) {
    return Response.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: [
    // Protect everything except static files and public metadata routes.
    // Image files (illustrations, avatar, icons, OG images) must stay public so the
    // login screen and the token-only TV kiosk can load them without a session.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|manifest.json|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)',
  ],
}
