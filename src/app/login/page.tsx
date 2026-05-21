import { auth, signIn } from "@/auth"
import { redirect } from "next/navigation"

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth()
  if (session) redirect('/')

  const searchParams = await props.searchParams
  const error = searchParams.error

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="text-center mb-10">
        <h1 className="font-display text-5xl font-extrabold tracking-tight mb-2">
          GaeDHD
        </h1>
        <p className="text-muted text-sm max-w-xs mx-auto">
          Your ADHD brain&apos;s best friend.<br />
          Big goals, tiny steps, perfect timing.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 mb-6 max-w-xs text-center">
          <p className="text-sm text-red-700 dark:text-red-300">
            {error === 'AccessDenied'
              ? "Sorry, your email isn't on the access list. Ask the admin to add you!"
              : 'Something went wrong. Try again?'}
          </p>
        </div>
      )}

      <form
        action={async () => {
          "use server"
          await signIn("google", { redirectTo: "/" })
        }}
      >
        <button
          type="submit"
          className="flex items-center gap-3 bg-card border border-card-border rounded-2xl px-6 py-4 hover:border-foreground/20 transition-colors shadow-sm"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span className="font-semibold text-sm">Sign in with Google</span>
        </button>
      </form>

      <p className="text-[10px] text-muted mt-8 max-w-xs text-center">
        Access is limited to approved emails only.<br />
        Your data stays in your browser.
      </p>
    </div>
  )
}
