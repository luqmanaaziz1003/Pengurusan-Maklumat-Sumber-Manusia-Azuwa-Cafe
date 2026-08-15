"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Users, Inbox, CheckCircle2, Save } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"

const MANAGER_ROLES = ["pengurus", "admin"]

const ROLE_LABELS: Record<string, string> = {
  pekerja: "Pekerja",
  pengurus: "Pengurus",
  admin: "Admin",
}

type StaffRow = {
  id: string
  full_name: string | null
  username: string | null
  age: number | null
  role: string | null
  job_title: string | null
  phone: string | null
  avatar_url: string | null
  weekly_salary: number | null
}

// Format a numeric amount as RM 0.00.
function formatMoney(value: number | null): string {
  return value == null ? "—" : `RM ${value.toFixed(2)}`
}

// Build up-to-two-letter initials from a name for the avatar fallback.
function initials(name: string | null, fallback: string | null): string {
  const source = name?.trim() || fallback?.trim() || "?"
  const parts = source.split(/\s+/)
  const letters =
    parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

export default function SenaraiPekerjaPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selected, setSelected] = useState<StaffRow | null>(null)
  const [editRole, setEditRole] = useState("")
  const [editSalary, setEditSalary] = useState("")

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function loadStaff(excludeId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, username, age, role, job_title, phone, avatar_url, weekly_salary"
      )
      .ilike("role", "pekerja")
      .neq("id", excludeId)
      .order("full_name", { ascending: true })

    if (error) {
      // Surface the real Postgres/RLS error instead of showing an empty list
      // with no explanation.
      setLoadError(error.message)
      setStaff([])
      return
    }
    setLoadError(null)
    setStaff(data ?? [])
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      if (!active) return
      if (!profile || !MANAGER_ROLES.includes(profile.role)) {
        // Only managers may view the full staff roster.
        router.replace("/dashboard")
        return
      }

      setAuthorized(true)
      await loadStaff(user.id)
    }
    init()
    return () => {
      active = false
    }
  }, [router])

  function openDetails(person: StaffRow) {
    setSelected(person)
    setEditRole(person.role ?? "pekerja")
    setEditSalary(person.weekly_salary != null ? String(person.weekly_salary) : "")
    setSaveError(null)
    setSaved(false)
  }

  function closeDetails(open: boolean) {
    if (!open) {
      setSelected(null)
      setSaveError(null)
      setSaved(false)
    }
  }

  async function handleSave() {
    if (!selected) return
    setSaveError(null)

    let weeklySalary: number | null = null
    if (editSalary.trim()) {
      const value = Number(editSalary)
      if (Number.isNaN(value) || value < 0) {
        setSaveError("Sila masukkan gaji mingguan yang sah.")
        return
      }
      weeklySalary = value
    }

    setSaving(true)
    const { error } = await supabase
      .from("profiles")
      .update({ role: editRole, weekly_salary: weeklySalary })
      .eq("id", selected.id)
    setSaving(false)

    if (error) {
      setSaveError(error.message)
      return
    }

    setStaff((prev) =>
      editRole === "pekerja"
        ? prev.map((person) =>
            person.id === selected.id
              ? { ...person, role: editRole, weekly_salary: weeklySalary }
              : person
          )
        // Roster only lists staff with the "pekerja" role, so promoting
        // someone off it drops them from the list.
        : prev.filter((person) => person.id !== selected.id)
    )
    setSelected((prev) =>
      prev ? { ...prev, role: editRole, weekly_salary: weeklySalary } : prev
    )
    setSaved(true)
  }

  if (!authorized) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Memuatkan…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="p-0">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <Users className="size-6" />
            Senarai Pekerja
            <Badge variant="secondary" className="ml-1">
              {staff.length}
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {loadError ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-destructive">
              <Inbox className="size-8" />
              <p className="text-sm font-medium">Gagal memuatkan senarai pekerja.</p>
              <p className="max-w-md text-xs text-destructive/80">{loadError}</p>
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-muted-foreground">
              <Inbox className="size-8" />
              <p className="text-sm">Tiada pekerja (peranan &quot;pekerja&quot;) didaftarkan.</p>
              <p className="max-w-md text-xs">
                Jika anda pasti pekerja telah berdaftar, sahkan dasar RLS
                &quot;Profiles viewable by managers&quot; (dalam
                supabase/leave_applications_table.sql) telah dijalankan di
                Supabase SQL Editor, dan nilai lajur &quot;role&quot; pekerja
                tersebut ialah tepat &quot;pekerja&quot;.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pekerja</TableHead>
                  <TableHead>Jawatan</TableHead>
                  <TableHead>Peranan</TableHead>
                  <TableHead className="text-center">Umur</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead className="text-right">Gaji Mingguan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => openDetails(person)}
                        className="flex items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Avatar size="lg">
                          {person.avatar_url && (
                            <AvatarImage
                              src={person.avatar_url}
                              alt={person.full_name ?? ""}
                            />
                          )}
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {initials(person.full_name, person.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-primary hover:underline">
                            {person.full_name || "—"}
                          </p>
                          {person.username && (
                            <p className="text-xs text-muted-foreground">
                              @{person.username}
                            </p>
                          )}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.job_title || "—"}
                    </TableCell>
                    <TableCell>
                      {person.role ? (
                        <Badge variant="secondary">
                          {ROLE_LABELS[person.role] ?? person.role}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {person.age ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {person.phone || "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMoney(person.weekly_salary)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={selected != null} onOpenChange={closeDetails}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <div className="mb-2 flex items-center gap-3">
                  <Avatar size="lg">
                    {selected.avatar_url && (
                      <AvatarImage
                        src={selected.avatar_url}
                        alt={selected.full_name ?? ""}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(selected.full_name, selected.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle>{selected.full_name || "—"}</SheetTitle>
                    {selected.username && (
                      <p className="text-xs text-muted-foreground">
                        @{selected.username}
                      </p>
                    )}
                  </div>
                </div>
                <SheetDescription>
                  Urus peranan dan gaji mingguan pekerja ini.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
                {/* Read-only info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Jawatan</p>
                    <p className="font-medium">{selected.job_title || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Umur</p>
                    <p className="font-medium">{selected.age ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Telefon</p>
                    <p className="font-medium">{selected.phone || "—"}</p>
                  </div>
                </div>

                {saveError && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {saveError}
                  </div>
                )}
                {saved && !saveError && (
                  <div className="flex items-center gap-2 rounded-lg border-l-4 border-green-500 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                    <CheckCircle2 className="size-4 shrink-0" />
                    Perubahan telah disimpan.
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="role">Peranan</Label>
                  <Select
                    value={editRole}
                    onValueChange={(value) => {
                      setEditRole(value as string)
                      setSaved(false)
                    }}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Pilih peranan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pekerja">Pekerja</SelectItem>
                      <SelectItem value="pengurus">Pengurus</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="weeklySalary">Gaji Mingguan</Label>
                  <div className="relative">
                    <span className="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      RM
                    </span>
                    <Input
                      id="weeklySalary"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={editSalary}
                      onChange={(e) => {
                        setEditSalary(e.target.value)
                        setSaved(false)
                      }}
                      placeholder="0.00"
                      className="h-11 pl-10"
                    />
                  </div>
                </div>
              </div>

              <SheetFooter>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full gap-2"
                >
                  <Save className="size-4" />
                  {saving ? "Menyimpan…" : "Simpan Perubahan"}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
