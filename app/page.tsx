"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Star } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// Official multi-color Google "G" mark.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Runs when a session exists — either it already did, or we just returned
  // from the Google redirect. The gmail is recorded; a new account (no profile
  // yet) is sent to the register card, a returning one to the dashboard.
  useEffect(() => {
    let handled = false

    async function routeAfterAuth(user: User) {
      if (handled) return
      handled = true

      // Record the gmail + refresh last_login (best-effort; don't block login).
      await supabase.from("users").upsert(
        {
          id: user.id,
          email: user.email,
          last_login: new Date().toISOString(),
        },
        { onConflict: "id" }
      )

      // A profile row means the account has completed registration.
      const { data, error } = await supabase
        .from("profiles")
        .select("id, status")
        .eq("id", user.id)
        .maybeSingle()

      if (error) {
        console.error("Failed to look up profile:", error)
        setError(`Gagal log masuk: ${error.message}`)
        setLoading(false)
        handled = false
        return
      }

      // New gmail → register to fill in details; registered but not yet
      // approved by a manager → waiting page; approved → dashboard.
      if (!data) {
        router.replace("/register")
      } else if (data.status === "approved") {
        router.replace("/dashboard")
      } else {
        router.replace("/menunggu-kelulusan")
      }
    }

    // Handle both an already-active session (page load) and the auth event
    // fired when returning from the Google redirect.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) routeAfterAuth(session.user)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) routeAfterAuth(session.user)
    })

    return () => subscription.unsubscribe()
  }, [router])

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success the browser is redirected to Google, so no further work here.
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md gap-0 p-0">
        {/* Top accent bar */}
        <div className="h-2 bg-primary" />

        <CardHeader className="px-8 pt-10 text-center">
          <CardTitle className="text-4xl font-bold tracking-tight text-primary italic">
            azuwa cafe
          </CardTitle>
          <CardDescription className="mt-2">
            Log masuk dengan akaun Google anda untuk meneruskan.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pt-6 pb-10">
          {error && (
            <p className="mb-6 rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          {/* Google sign-in */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="h-12 w-full gap-3 text-base"
          >
            <GoogleIcon className="size-5" />
            {loading ? "Menyambung…" : "Log Masuk dengan Google"}
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
          </div>

          {/* Customer rating */}
          <p className="text-center text-sm text-muted-foreground">
            Anda pelanggan kami?
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-4 h-12 w-full gap-2 border-2 border-green-500 text-base font-bold text-green-600 hover:bg-green-50 hover:text-green-700"
          >
            <Star className="size-5" />
            Penilaian Pekerja
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
