"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { UserPlus } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function RegisterPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [age, setAge] = useState("")
  const [role, setRole] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Registration needs a Google session. Bounce to login without one, and skip
  // the form if this account already has a profile (already registered).
  useEffect(() => {
    let active = true
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return
      if (!session) {
        router.replace("/")
        return
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .maybeSingle()

      if (!active) return
      if (existing) {
        router.replace("/dashboard")
        return
      }

      setUser(session.user)
      const googleName = session.user.user_metadata?.full_name
      if (typeof googleName === "string") setFullName(googleName)
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!user) return

    if (!role) {
      setError("Sila pilih peranan anda.")
      return
    }

    setError(null)
    setSaving(true)
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName.trim(),
      username: username.trim(),
      age: age ? Number(age) : null,
      role,
    })

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    router.replace("/dashboard")
  }

  // Avoid flashing the form before the session check resolves.
  if (!user) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted p-4">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </main>
    )
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md gap-0 p-0">
        {/* Top accent bar */}
        <div className="h-2 bg-primary" />

        <CardHeader className="px-8 pt-8 text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Daftar Akaun
          </CardTitle>
          <CardDescription className="mt-1">
            Selamat Datang pekerja baru Azuwa Cafe.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pt-6 pb-8">
          {/* Google account this profile is tied to */}
          <p className="mb-6 rounded-lg bg-muted px-4 py-2.5 text-center text-sm text-muted-foreground">
            Akaun Google:{" "}
            <span className="font-semibold text-foreground">{user.email}</span>
          </p>

          {error && (
            <p className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nama Penuh</Label>
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama penuh anda"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Nama Pengguna</Label>
              <Input
                id="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nama pengguna"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="age">Umur</Label>
              <Input
                id="age"
                type="number"
                required
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Umur anda"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role">Peranan</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole((value as string) ?? "")}
              >
                <SelectTrigger id="role" className="h-11 w-full">
                  <SelectValue placeholder="-- Pilih Peranan --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pekerja">Pekerja</SelectItem>
                  <SelectItem value="pengurus">Pengurus</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="h-12 w-full gap-2 text-base font-semibold"
            >
              <UserPlus className="size-5" />
              {saving ? "Menyimpan…" : "Daftar Akaun"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
