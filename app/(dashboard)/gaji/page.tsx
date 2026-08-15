"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  HandCoins,
  Info,
  Send,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RequestStatusBadge } from "@/components/RequestStatusBadge"

type AdvanceRequest = {
  id: string
  amount: number
  reason: string | null
  deduction_month: string | null
  status: string
  created_at: string
}

// Format a numeric amount as RM 0.00.
function formatMoney(value: number): string {
  return `RM ${value.toFixed(2)}`
}

// Format a yyyy-mm-dd (1st of month) as mm/yyyy.
function formatMonth(value: string | null): string {
  if (!value) return "—"
  const [y, m] = value.split("-")
  return m && y ? `${m}/${y}` : value
}

const ADVANCE_LIMIT_RATIO = 0.3

// Pay week runs Saturday → Thursday (salary is paid every Thursday; Friday is
// a day off and doesn't belong to any week). Returns the [start, endExclusive)
// bounds of the pay week that `date` falls in — Friday is treated as already
// belonging to the upcoming week, since Thursday's payment just reset it.
function getPayWeekRange(date: Date): { start: Date; endExclusive: Date } {
  const day = date.getDay() // Sun=0 … Sat=6
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (day === 5) {
    start.setDate(start.getDate() + 1)
  } else {
    const daysSinceSaturday = (day + 1) % 7
    start.setDate(start.getDate() - daysSinceSaturday)
  }
  const endExclusive = new Date(start)
  endExclusive.setDate(endExclusive.getDate() + 6) // through Thursday, up to next Friday
  return { start, endExclusive }
}

export default function MohonGajiAwalPage() {
  const router = useRouter()
  const [userId, setUserId] = useState("")
  const [requests, setRequests] = useState<AdvanceRequest[]>([])
  const [weeklySalary, setWeeklySalary] = useState<number | null>(null)

  const [amount, setAmount] = useState("")
  const [deductionMonth, setDeductionMonth] = useState("")
  const [reason, setReason] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const maxAmount =
    weeklySalary != null ? weeklySalary * ADVANCE_LIMIT_RATIO : null

  const { start: weekStart, endExclusive: weekEndExclusive } =
    getPayWeekRange(new Date())
  const usedThisWeek = requests
    .filter((r) => {
      if (r.status === "rejected") return false
      const created = new Date(r.created_at)
      return created >= weekStart && created < weekEndExclusive
    })
    .reduce((sum, r) => sum + r.amount, 0)
  const remainingThisWeek =
    maxAmount != null ? Math.max(0, maxAmount - usedThisWeek) : null

  async function loadRequests(uid: string) {
    const { data } = await supabase
      .from("salary_advance_applications")
      .select("id, amount, reason, deduction_month, status, created_at")
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("weekly_salary")
        .eq("id", user.id)
        .maybeSingle()
      if (!active) return
      setWeeklySalary(profile?.weekly_salary ?? null)

      await loadRequests(user.id)
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const value = Number(amount)
    if (!amount || Number.isNaN(value) || value <= 0) {
      setError("Sila masukkan jumlah pendahuluan yang sah.")
      return
    }
    if (remainingThisWeek != null && value > remainingThisWeek) {
      setError(
        `Jumlah pendahuluan melebihi baki had minggu ini. Anda boleh memohon sehingga ${formatMoney(
          remainingThisWeek
        )} lagi minggu ini (had mingguan 30% = ${formatMoney(maxAmount ?? 0)}).`
      )
      return
    }
    if (!reason.trim()) {
      setError("Sila nyatakan sebab / tujuan permohonan.")
      return
    }

    setSubmitting(true)
    const { error } = await supabase
      .from("salary_advance_applications")
      .insert({
        user_id: userId,
        amount: value,
        reason: reason.trim(),
        deduction_month: deductionMonth ? `${deductionMonth}-01` : null,
        status: "pending",
      })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess(true)
    setAmount("")
    setDeductionMonth("")
    setReason("")
    loadRequests(userId)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <HandCoins className="size-6" />
            Borang Mohon Gaji Awal
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5 px-6 py-6">
          {/* Note */}
          <div className="flex items-start gap-2 rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <span className="font-semibold">Nota:</span> Pendahuluan gaji akan
              ditolak daripada gaji pada bulan potongan yang dipilih. Anda boleh
              memohon berkali-kali dalam minggu yang sama selagi jumlah
              keseluruhan tidak melebihi 30% gaji mingguan anda. Minggu gaji
              bermula Sabtu dan berakhir Khamis (gaji dibayar setiap Khamis;
              Jumaat cuti).
            </p>
          </div>

          {/* Success state */}
          {success && (
            <div className="flex items-center gap-2 rounded-lg border-l-4 border-green-500 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              <CheckCircle2 className="size-4 shrink-0" />
              Permohonan anda telah dihantar dan menunggu kelulusan.
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
              <Label htmlFor="amount">Jumlah Dipohon</Label>
              <div className="relative">
                <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  RM
                </span>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  max={remainingThisWeek ?? undefined}
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setSuccess(false)
                  }}
                  placeholder="0.00"
                  className="h-11 pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {maxAmount != null
                  ? `Had mingguan (30% gaji mingguan): ${formatMoney(
                      maxAmount
                    )}. Baki boleh dipohon minggu ini: ${formatMoney(
                      remainingThisWeek ?? 0
                    )}.`
                  : "Had permohonan ialah 30% daripada gaji mingguan anda."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deductionMonth">Bulan Potongan</Label>
              <Input
                id="deductionMonth"
                type="month"
                value={deductionMonth}
                onChange={(e) => {
                  setDeductionMonth(e.target.value)
                  setSuccess(false)
                }}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Bulan gaji yang akan ditolak untuk pendahuluan ini.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">Sebab / Tujuan Permohonan</Label>
              <Textarea
                id="reason"
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nyatakan tujuan permohonan gaji awal anda…"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
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
              Belum ada permohonan gaji awal.
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
                      {formatMoney(req.amount)}
                      <span className="text-muted-foreground">
                        {" "}
                        · Potongan {formatMonth(req.deduction_month)}
                      </span>
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
