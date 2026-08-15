"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Star, Users, Inbox, Check } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Coworker = {
  id: string
  full_name: string | null
  username: string | null
  job_title: string | null
  avatar_url: string | null
}

type ExistingRating = { rating: number; comment: string | null }

function initials(name: string | null, fallback: string | null): string {
  const source = name?.trim() || fallback?.trim() || "?"
  const parts = source.split(/\s+/)
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

// Interactive 1–5 star picker.
function StarPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const active = (hover || value) >= n
        return (
          <button
            key={n}
            type="button"
            aria-label={`${n} bintang`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="rounded-sm p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                active
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

// One coworker row with its own rating state.
function RateCard({
  userId,
  coworker,
  existing,
}: {
  userId: string
  coworker: Coworker
  existing?: ExistingRating
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(Boolean(existing))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (rating < 1) {
      setError("Sila pilih bintang penilaian.")
      return
    }
    setError(null)
    setSaving(true)
    const { error } = await supabase.from("peer_ratings").upsert(
      {
        rater_id: userId,
        ratee_id: coworker.id,
        rating,
        comment: comment.trim() || null,
      },
      { onConflict: "rater_id,ratee_id" }
    )
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
  }

  return (
    <Card className="p-0">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {coworker.avatar_url && (
              <AvatarImage
                src={coworker.avatar_url}
                alt={coworker.full_name ?? ""}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials(coworker.full_name, coworker.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{coworker.full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">
              {coworker.job_title || "Pekerja"}
            </p>
          </div>
          {saved && (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400">
              <Check className="size-3" />
              Dinilai
            </Badge>
          )}
        </div>

        <StarPicker
          value={rating}
          onChange={(v) => {
            setRating(v)
            setSaved(false)
          }}
        />

        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            setSaved(false)
          }}
          placeholder="Komen (pilihan)…"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Menyimpan…" : saved ? "Kemaskini" : "Hantar Penilaian"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function NilaiRakanPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [coworkers, setCoworkers] = useState<Coworker[]>([])
  const [ratings, setRatings] = useState<Map<string, ExistingRating>>(new Map())
  const [ready, setReady] = useState(false)

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
      setUserId(user.id)

      const [{ data: people }, { data: myRatings }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username, job_title, avatar_url")
          .neq("id", user.id)
          .order("full_name", { ascending: true }),
        supabase
          .from("peer_ratings")
          .select("ratee_id, rating, comment")
          .eq("rater_id", user.id),
      ])

      if (!active) return
      setCoworkers(people ?? [])
      const map = new Map<string, ExistingRating>()
      for (const r of myRatings ?? []) {
        map.set(r.ratee_id, { rating: r.rating, comment: r.comment })
      }
      setRatings(map)
      setReady(true)
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  if (!ready || !userId) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <Star className="size-6" />
            Nilai Rakan Sekerja
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-4">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            Beri penilaian bintang dan komen untuk rakan sekerja anda.
          </p>
        </CardContent>
      </Card>

      {coworkers.length === 0 ? (
        <Card className="p-0">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Inbox className="size-8" />
            <p className="text-sm">Tiada rakan sekerja untuk dinilai.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {coworkers.map((c) => (
            <RateCard
              key={c.id}
              userId={userId}
              coworker={c}
              existing={ratings.get(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
