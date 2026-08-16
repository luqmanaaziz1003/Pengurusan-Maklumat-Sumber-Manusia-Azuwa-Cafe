"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import {
  QrCode,
  Filter,
  Clock,
  SquarePen,
  Check,
  X,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MANAGER_ROLES = ["pengurus", "admin"]
const REFRESH_SECONDS = 15

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDateLabel(value: string): string {
  const [y, m, d] = value.split("-")
  return `${d}/${m}/${y}`
}

function formatTime(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

type RosterEntry = {
  id: string
  full_name: string | null
  username: string | null
  scannedAt: string | null
  onLeave: boolean
}

export default function QrKehadiranPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [userId, setUserId] = useState("")

  const [date, setDate] = useState(todayStr())
  const [started, setStarted] = useState(false)
  const [starting, setStarting] = useState(false)

  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)

  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS)

  const [now, setNow] = useState(new Date())

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
        router.replace("/dashboard")
        return
      }

      setUserId(user.id)
      setAuthorized(true)
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  // Live clock for the filter bar.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function loadAttendance(forDate: string) {
    const [{ data: staff, error: staffError }, { data: leave }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username")
          .ilike("role", "pekerja")
          .eq("status", "approved")
          .order("full_name", { ascending: true }),
        supabase
          .from("leave_applications")
          .select("user_id")
          .eq("status", "approved")
          .lte("start_date", forDate)
          .gte("end_date", forDate),
      ])

    if (staffError) {
      setRosterError(staffError.message)
      return
    }

    const { data: attendance, error: attendanceError } = await supabase
      .from("attendance_records")
      .select("user_id, scanned_at")
      .eq("attendance_date", forDate)

    if (attendanceError) {
      setRosterError(attendanceError.message)
      return
    }

    const onLeaveIds = new Set((leave ?? []).map((r) => r.user_id))
    const scannedAt = new Map(
      (attendance ?? []).map((r) => [r.user_id, r.scanned_at as string])
    )

    setRosterError(null)
    setRoster(
      (staff ?? []).map((p) => ({
        ...p,
        scannedAt: scannedAt.get(p.id) ?? null,
        onLeave: onLeaveIds.has(p.id),
      }))
    )
  }

  async function mintSession(forDate: string) {
    const { data, error } = await supabase
      .from("attendance_qr_sessions")
      .insert({ created_by: userId, attendance_date: forDate })
      .select("token")
      .single()

    if (error || !data) {
      setQrError(error?.message ?? "Gagal menjana kod QR.")
      return
    }
    setQrError(null)
    const dataUrl = await QRCode.toDataURL(data.token, {
      width: 220,
      margin: 1,
    })
    setQrImage(dataUrl)
    setSecondsLeft(REFRESH_SECONDS)
  }

  async function handleGenerate() {
    setStarting(true)
    await loadAttendance(date)
    setStarting(false)
    setStarted(true)
    await mintSession(date)
  }

  function handleChangeDate() {
    setStarted(false)
    setQrImage(null)
  }

  useEffect(() => {
    if (!started) return
    const refreshInterval = setInterval(() => {
      mintSession(date)
      loadAttendance(date)
    }, REFRESH_SECONDS * 1000)
    const tickInterval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => {
      clearInterval(refreshInterval)
      clearInterval(tickInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, date])

  async function handleMarkPresent(personId: string) {
    setActingId(personId)
    const { error } = await supabase.from("attendance_records").upsert(
      {
        user_id: personId,
        attendance_date: date,
        method: "manual",
        marked_by: userId,
        scanned_at: new Date().toISOString(),
      },
      { onConflict: "user_id,attendance_date" }
    )
    if (!error) await loadAttendance(date)
    setActingId(null)
  }

  async function handleUnmark(personId: string) {
    setActingId(personId)
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("user_id", personId)
      .eq("attendance_date", date)
    if (!error) await loadAttendance(date)
    setActingId(null)
  }

  if (!authorized) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </div>
    )
  }

  const hadirCount = roster.filter((r) => r.scannedAt).length
  const cutiCount = roster.filter((r) => r.onLeave && !r.scannedAt).length
  const belumHadirCount = roster.length - hadirCount - cutiCount

  if (!started) {
    return (
      <div className="mx-auto flex max-w-md flex-1 items-center justify-center">
        <Card className="w-full">
          <CardContent className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-primary">
              <QrCode className="size-6" />
              <h2 className="text-lg font-semibold">Jana QR Kehadiran</h2>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qrDate">Tarikh Kehadiran</Label>
              <Input
                id="qrDate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
              />
            </div>
            {rosterError && (
              <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {rosterError}
              </p>
            )}
            <Button
              onClick={handleGenerate}
              disabled={starting || !date}
              className="h-11 w-full gap-2"
            >
              <QrCode className="size-4" />
              {starting ? "Menjana…" : "Jana Kod QR"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Pekerja Hadir",
            value: hadirCount,
            bar: "bg-green-500",
          },
          {
            label: "Belum Hadir",
            value: belumHadirCount,
            bar: "bg-red-500",
          },
          {
            label: "Dibenarkan Cuti",
            value: cutiCount,
            bar: "bg-amber-400",
          },
          {
            label: "Jumlah Pekerja",
            value: roster.length,
            bar: "bg-primary",
            highlight: true,
          },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={
              stat.highlight
                ? "gap-0 overflow-hidden border-primary/30 bg-primary/5 p-0"
                : "gap-0 overflow-hidden p-0"
            }
          >
            <CardContent className="p-5">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {stat.label}
              </p>
            </CardContent>
            <div className={`h-1 ${stat.bar}`} />
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Staff table */}
        <Card className="gap-0 p-0">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="size-4" />
              Paparan: Semua ({formatDateLabel(date)})
            </p>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {now.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-primary text-primary-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">#</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Nama Pekerja
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Status / Masa
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {roster.map((person, index) => (
                  <tr key={person.id}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {index + 1}.
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {person.full_name || person.username || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {person.onLeave && !person.scannedAt ? (
                        <span className="font-medium text-amber-600">
                          Bercuti
                        </span>
                      ) : person.scannedAt ? (
                        <span className="font-medium text-green-600">
                          Hadir · {formatTime(person.scannedAt)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Belum Hadir
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          aria-label="Tandakan Hadir"
                          onClick={() => handleMarkPresent(person.id)}
                          disabled={
                            actingId === person.id || !!person.scannedAt
                          }
                          className="flex size-7 items-center justify-center rounded-full bg-green-600 text-white transition-opacity hover:bg-green-700 disabled:opacity-30"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Batalkan Kehadiran"
                          onClick={() => handleUnmark(person.id)}
                          disabled={
                            actingId === person.id || !person.scannedAt
                          }
                          className="flex size-7 items-center justify-center rounded-full bg-red-500 text-white transition-opacity hover:bg-red-600 disabled:opacity-30"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {roster.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      Tiada pekerja didaftarkan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* QR panel */}
        <Card className="h-fit gap-4 border-primary/30 p-5">
          <p className="text-center text-sm font-semibold tracking-wide text-primary uppercase">
            QR Kehadiran
          </p>

          {qrError ? (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {qrError}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-56 items-center justify-center rounded-lg border bg-white p-3">
                {qrImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrImage}
                    alt="Kod QR kehadiran"
                    className="size-full"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Menjana kod…
                  </p>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(secondsLeft / REFRESH_SECONDS) * 100}%`,
                  }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                QR dikemaskini secara automatik
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleChangeDate}
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <SquarePen className="size-3.5" />
            Pilih Tarikh Lain
          </button>
        </Card>
      </div>
    </div>
  )
}
