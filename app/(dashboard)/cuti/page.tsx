"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Info,
  Send,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  AlertTriangle,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RequestStatusBadge } from "@/components/RequestStatusBadge"

const MONTHLY_LEAVE = 4
const FRIDAY = 5

type LeaveRequest = {
  id: string
  start_date: string
  end_date: string
  reason: string | null
  days: number | null
  status: string
  created_at: string
}

// Format a yyyy-mm-dd string as dd/mm/yyyy for display.
function formatDate(value: string): string {
  const [y, m, d] = value.split("-")
  return d && m && y ? `${d}/${m}/${y}` : value
}

// Format a local Date as yyyy-mm-dd (avoids UTC/timezone shifting).
function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export default function MohonCutiPage() {
  const router = useRouter()
  const [userId, setUserId] = useState("")
  const [usedThisMonth, setUsedThisMonth] = useState(0)
  const [requests, setRequests] = useState<LeaveRequest[]>([])

  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [dateWarning, setDateWarning] = useState<string | null>(null)
  const [reason, setReason] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  async function loadBalance(uid: string) {
    const toISO = (d: Date) => toISODate(d)

    const { data } = await supabase
      .from("leave_applications")
      .select("days, status")
      .eq("user_id", uid)
      .gte("start_date", toISO(firstOfMonth))
      .lte("start_date", toISO(lastOfMonth))
      .neq("status", "rejected")

    const used = (data ?? []).reduce((sum, row) => sum + (row.days ?? 0), 0)
    setUsedThisMonth(used)
  }

  async function loadRequests(uid: string) {
    const { data } = await supabase
      .from("leave_applications")
      .select("id, start_date, end_date, reason, days, status, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
    setRequests(data ?? [])
  }

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
      await Promise.all([loadBalance(user.id), loadRequests(user.id)])
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  const baki = Math.max(0, MONTHLY_LEAVE - usedThisMonth)
  const requestedDays = selectedDates.length

  function handleSelectDates(dates: Date[] | undefined) {
    const next = dates ?? []
    if (next.length > baki) {
      setDateWarning(
        baki === 0
          ? `Baki cuti bulan ini telah digunakan sepenuhnya (${MONTHLY_LEAVE} hari). Anda tidak boleh memohon cuti tambahan bulan ini.`
          : `Anda hanya boleh memohon ${baki} hari cuti lagi bulan ini.`
      )
      return
    }
    setDateWarning(null)
    setSelectedDates(next)
    setSuccess(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (selectedDates.length === 0) {
      setError("Sila pilih sekurang-kurangnya satu tarikh cuti.")
      return
    }
    if (requestedDays > baki) {
      setError(
        `Permohonan ${requestedDays} hari melebihi baki cuti anda (${baki} hari).`
      )
      return
    }

    setSubmitting(true)
    const rows = selectedDates
      .slice()
      .sort((a, b) => a.getTime() - b.getTime())
      .map((date) => {
        const iso = toISODate(date)
        return {
          user_id: userId,
          start_date: iso,
          end_date: iso,
          reason: reason.trim() || null,
          days: 1,
          status: "pending",
        }
      })

    const { error } = await supabase.from("leave_applications").insert(rows)
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    setSelectedDates([])
    setDateWarning(null)
    setReason("")
    loadBalance(userId)
    loadRequests(userId)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <CalendarDays className="size-6" />
            Borang Mohon Cuti
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 px-6 py-6">
          {/* Leave balance */}
          <div className="rounded-lg border-l-4 border-green-500 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-700">
            Baki Cuti Bulan Ini: {baki} / {MONTHLY_LEAVE} Hari
          </div>

          {/* Note */}
          <div className="flex items-start gap-2 rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <span className="font-semibold">Nota:</span> Cuti hari Jumaat
              tidak dibenarkan. Anda boleh pilih sehingga {MONTHLY_LEAVE} tarikh
              berasingan (tidak semestinya berturutan) dalam bulan ini.
            </p>
          </div>

          {/* Monthly limit reached */}
          {baki === 0 && (
            <div className="flex items-start gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                Baki cuti bulan ini telah digunakan sepenuhnya. Anda tidak
                boleh memohon cuti tambahan sehingga bulan hadapan.
              </p>
            </div>
          )}

          {/* Date selection warning */}
          {dateWarning && (
            <div className="flex items-start gap-2 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>{dateWarning}</p>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border-l-4 border-green-500 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              <CheckCircle2 className="size-4 shrink-0" />
              Permohonan cuti anda telah dihantar dan menunggu kelulusan.
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label>Pilih Tarikh Cuti</Label>
              <div className="flex justify-center rounded-lg border">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={handleSelectDates}
                  defaultMonth={firstOfMonth}
                  startMonth={firstOfMonth}
                  endMonth={lastOfMonth}
                  disableNavigation
                  disabled={[{ dayOfWeek: [FRIDAY] }, { before: today }]}
                  className="p-3"
                />
              </div>
              {requestedDays > 0 && (
                <p className="text-sm text-muted-foreground">
                  Jumlah hari dipohon:{" "}
                  <span className="font-semibold text-foreground">
                    {requestedDays} hari
                  </span>{" "}
                  ({selectedDates
                    .slice()
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d) => formatDate(toISODate(d)))
                    .join(", ")})
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Sebab / Alasan Cuti</Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nyatakan sebab permohonan cuti anda…"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || selectedDates.length === 0}
              className="h-12 w-full gap-2 text-base font-semibold"
            >
              <Send className="size-5" />
              {submitting ? "Menghantar…" : "Hantar Permohonan"}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard")}
              className="gap-2 text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              Kembali
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Request history */}
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="size-5 text-primary" />
            Sejarah Permohonan
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 py-6">
          {requests.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Belum ada permohonan cuti.
            </p>
          ) : (
            <ul className="divide-y">
              {requests.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {req.start_date === req.end_date
                        ? formatDate(req.start_date)
                        : `${formatDate(req.start_date)} – ${formatDate(
                            req.end_date
                          )}`}
                      {req.days != null && (
                        <span className="text-muted-foreground">
                          {" "}
                          ({req.days} hari)
                        </span>
                      )}
                    </p>
                    {req.reason && (
                      <p className="truncate text-sm text-muted-foreground">
                        {req.reason}
                      </p>
                    )}
                  </div>
                  <RequestStatusBadge status={req.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
