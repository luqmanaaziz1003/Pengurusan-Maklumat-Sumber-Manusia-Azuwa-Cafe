"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Hourglass, XCircle, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function MenungguKelulusanPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"pending" | "rejected" | null>(null)

  useEffect(() => {
    let active = true
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return
      if (!user) {
        router.replace("/")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle()

      if (!active) return
      if (!profile) {
        router.replace("/register")
        return
      }
      if (profile.status === "approved") {
        router.replace("/dashboard")
        return
      }
      setStatus(profile.status === "rejected" ? "rejected" : "pending")
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/")
  }

  if (!status) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted p-4">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </main>
    )
  }

  const rejected = status === "rejected"

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md gap-0 p-0">
        <div className={rejected ? "h-2 bg-destructive" : "h-2 bg-primary"} />

        <CardHeader className="items-center px-8 pt-10 text-center">
          <div
            className={
              rejected
                ? "mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                : "mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary"
            }
          >
            {rejected ? (
              <XCircle className="size-7" />
            ) : (
              <Hourglass className="size-7" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {rejected ? "Permohonan Ditolak" : "Menunggu Kelulusan"}
          </CardTitle>
          <CardDescription className="mt-1">
            {rejected
              ? "Pengurus telah menolak permohonan pendaftaran akaun anda."
              : "Akaun anda telah didaftarkan dan sedang menunggu kelulusan pengurus."}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pt-6 pb-10">
          <p className="mb-6 text-center text-sm text-muted-foreground">
            {rejected
              ? "Sila hubungi pengurus anda jika ini tidak dijangka."
              : "Anda akan dapat mengakses papan pemuka sebaik sahaja akaun anda diluluskan. Sila semak semula kemudian."}
          </p>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleLogout}
            className="h-12 w-full gap-2 text-base"
          >
            <LogOut className="size-5" />
            Log Keluar
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
