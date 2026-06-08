import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

// Comma-separated list of allowed emails from env var
// e.g. ALLOWED_EMAILS="wife@gmail.com,john@gmail.com"
function getAllowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS || ''
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ user }) {
      const allowed = getAllowedEmails()
      // Fail CLOSED: an empty allowlist denies everyone in production, so a blank
      // or mistyped ALLOWED_EMAILS can never silently open the app to the whole
      // internet. Allow-all stays available only in local dev.
      if (allowed.length === 0) return process.env.NODE_ENV !== 'production'
      // Check if user's email is in the allowlist
      const email = user.email?.toLowerCase()
      if (!email || !allowed.includes(email)) {
        return false // blocks sign-in
      }
      return true
    },
    // Ensure email is available in the session
    session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
})
