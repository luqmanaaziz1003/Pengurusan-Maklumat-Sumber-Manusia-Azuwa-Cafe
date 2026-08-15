"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, ClipboardCheck, Inbox } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RequestStatusBadge } from "@/components/RequestStatusBadge"

const MANAGER_ROLES = ["pengurus", "admin"]

type LeaveRow = {
  id: string
  user_id: string
  start_date: string
  end_date: string
  reason: string | null
  days: number | null
  status: string
  created_at: string
  applicant: string
}

function formatDate(value: string): string {
  const [y, m, d] = value.split("-")
  return d && m && y ? `${d}/${m}/${y}` : value
}

export default function SemakCutiPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [rows, setRows] = useState<LeaveRow[]>([])
  const [actingId, setActingId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const { data: leaves } = await supabase
      .from("leave_applications")
      .select("id, user_id, start_date, end_date, reason, days, status, created_at")
      .order("created_at", { ascending: false })

    const list = leaves ?? []
    const ids = [...new Set(list.map((r) => r.user_id))]

    // leave_applications has no FK to profiles, so resolve names separately.
    const names = new Map<string, string>()
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", ids)
      for (const p of profiles ?? []) {
        names.set(p.id, p.full_name || p.username || "Pekerja")
      }
    }

    setRows(
      list.map((r) => ({
        ...r,
        applicant: names.get(r.user_id) ?? "Pekerja",
      }))
    )
  }, [])

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
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (!active) return
      if (!profile || !MANAGER_ROLES.includes(profile.role)) {
        // Only managers may review requests.
        router.replace("/dashboard")
        return
      }

      setAuthorized(true)
      await loadRequests()
    }
    init()
    return () => {
      active = false
    }
  }, [router, loadRequests])

  async function handleAction(id: string, status: "approved" | "rejected") {
    setActingId(id)
    const { error } = await supabase
      .from("leave_applications")
      .update({ status })
      .eq("id", id)
    if (!error) await loadRequests()
    setActingId(null)
  }

  if (!authorized) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </div>
    )
  }

  const pending = rows.filter((r) => r.status === "pending")
  const approved = rows.filter((r) => r.status === "approved")
  const rejected = rows.filter((r) => r.status === "rejected")

  function renderList(list: LeaveRow[], showActions: boolean) {
    if (list.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <Inbox className="size-8" />
          <p className="text-sm">Tiada permohonan.</p>
        </div>
      )
    }
    return (
      <ul className="divide-y">
        {list.map((req) => (
          <li
            key={req.id}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{req.applicant}</p>
                {!showActions && <RequestStatusBadge status={req.status} />}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {req.start_date === req.end_date
                  ? formatDate(req.start_date)
                  : `${formatDate(req.start_date)} – ${formatDate(
                      req.end_date
                    )}`}
                {req.days != null && ` · ${req.days} hari`}
              </p>
              {req.reason && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  “{req.reason}”
                </p>
              )}
            </div>

            {showActions && (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAction(req.id, "approved")}
                  disabled={actingId === req.id}
                  className="gap-1.5 bg-green-600 text-white hover:bg-green-700"
                >
                  <Check className="size-4" />
                  Lulus
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(req.id, "rejected")}
                  disabled={actingId === req.id}
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="size-4" />
                  Tolak
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <ClipboardCheck className="size-6" />
            Semak Permohonan Cuti
          </CardTitle>
        </CardHeader>

        <CardContent className="px-6 py-6">
          <Tabs defaultValue="pending">
            <TabsList className="mb-4 h-9 w-full">
              <TabsTrigger value="pending">
                Menunggu ({pending.length})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Diluluskan ({approved.length})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Ditolak ({rejected.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {renderList(pending, true)}
            </TabsContent>
            <TabsContent value="approved">
              {renderList(approved, false)}
            </TabsContent>
            <TabsContent value="rejected">
              {renderList(rejected, false)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
