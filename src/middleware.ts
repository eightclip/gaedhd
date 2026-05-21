import { auth } from "@/auth"

export default auth((req) => {
  const isLoggedIn = !!req.auth

  // Public paths that don't require auth
  const isPublicPath =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/api/auth')

  if (!isLoggedIn && !isPublicPath) {
    return Response.redirect(new URL('/login', req.nextUrl.origin))
  }
})

export const config = {
  matcher: [
    // Protect everything except static files and images
    '/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest.json).*)',
  ],
}
