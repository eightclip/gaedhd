import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth

  // Public paths that don't require auth
  // (/api/now is token-protected in the route itself, for ambient IoT devices)
  const isPublicPath =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/now') ||
    req.nextUrl.pathname.startsWith('/api/calendar') ||
    // The office TV kiosk is token-gated in the page/endpoint, not by session.
    req.nextUrl.pathname.startsWith('/kiosk')

  if (!isLoggedIn && !isPublicPath) {
    return Response.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: [
    // Protect everything except static files and public metadata routes
    // (icons + OG images must stay public so browsers and social crawlers can fetch them)
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|manifest.json).*)',
  ],
}
