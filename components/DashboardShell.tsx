"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Calendar,
  Wallet,
  ListChecks,
  Star,
  Settings,
  LogOut,
  PanelLeft,
  Award,
  QrCode,
  Coffee,
  ChevronsUpDown,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import AttendanceQrSheet from "@/components/AttendanceQrSheet"

type NavItem = {
  key: string
  label: string
  Icon: React.ComponentType<{ className?: string }>
  href?: string
  managerOnly?: boolean
  staffOnly?: boolean
  adminOnly?: boolean
}

const MANAGER_ROLES = ["pengurus", "admin"]

const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Halaman Utama", Icon: LayoutDashboard, href: "/dashboard" },
  {
    key: "pekerja",
    label: "Senarai Pekerja",
    Icon: User,
    href: "/senarai-pekerja",
    managerOnly: true,
  },
  { key: "cuti", label: "Mohon Cuti", Icon: Calendar, href: "/cuti", staffOnly: true },
  {
    key: "gaji",
    label: "Mohon Gaji Awal",
    Icon: Wallet,
    href: "/gaji",
    staffOnly: true,
  },
  {
    key: "semak-cuti",
    label: "Semak Cuti",
    Icon: ListChecks,
    href: "/semak-cuti",
    managerOnly: true,
  },
  {
    key: "semak-gaji",
    label: "Semak Gaji Awal",
    Icon: Wallet,
    href: "/semak-gaji",
    managerOnly: true,
  },
  {
    key: "qr-kehadiran",
    label: "QR Kehadiran",
    Icon: QrCode,
    href: "/qr-kehadiran",
    managerOnly: true,
  },
  {
    key: "nilai",
    label: "Nilai Rakan Sekerja",
    Icon: Star,
    href: "/nilai-rakan",
    // Hidden for pekerja and pengurus for now — keep the page, just don't
    // surface it in nav until this is ready to launch.
    adminOnly: true,
  },
]

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  // Routed items reflect the URL; placeholder items use local highlight state.
  const [active, setActive] = useState("home")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)

  const isManager = role != null && MANAGER_ROLES.includes(role)
  const navItems = NAV_ITEMS.filter(
    (item) =>
      (!item.managerOnly || isManager) &&
      (!item.staffOnly || !isManager) &&
      (!item.adminOnly || role === "admin")
  )

  // Keep the highlight in sync with the current route on navigation/refresh.
  useEffect(() => {
    const match = NAV_ITEMS.find(
      (item) =>
        item.href &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`))
    )
    if (match) setActive(match.key)
  }, [pathname])

  // Show the signed-in account's email in the profile menu, and load the role
  // so manager-only navigation can be shown/hidden.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user?.email) setEmail(data.user.email)
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", data.user.id)
          .maybeSingle()
        // Accounts awaiting or refused approval have no business in the
        // dashboard, even if they navigate here directly.
        if (!profile || profile.status !== "approved") {
          router.replace(profile ? "/menunggu-kelulusan" : "/register")
          return
        }
        setRole(profile.role ?? null)
      }
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace("/")
  }

  const activeLabel =
    NAV_ITEMS.find((item) => item.key === active)?.label ?? "Halaman Utama"

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r bg-background transition-[width] duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex h-16 items-center px-3",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? (
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Coffee className="size-5" />
            </span>
          ) : (
            <div className="flex w-full items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Coffee className="size-5" />
              </span>
              <div className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">
                  Azuwa Cafe
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Sistem Pekerja
                </span>
              </div>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <ul className="space-y-1">
            {navItems.map(({ key, label, Icon, href }) => {
              const isActive = key === active
              return (
                <li key={key}>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setActive(key)
                      if (href) router.push(href)
                    }}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "h-11 w-full gap-3 text-sm font-medium",
                      collapsed ? "justify-center px-0" : "justify-start px-3",
                      isActive
                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon className="size-5 shrink-0" />
                    {!collapsed && <span>{label}</span>}
                  </Button>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Profile (bottom of sidebar) */}
        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  title={collapsed ? "luqman" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                    collapsed ? "justify-center" : "justify-start"
                  )}
                >
                  <Avatar size="lg">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      L
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
                        luqman
                      </span>
                      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                    </>
                  )}
                </button>
              }
            />
            <DropdownMenuContent side="top" align="start" className="w-60">
              {/* Account header */}
              <div className="flex items-center gap-2 px-1.5 py-1.5">
                <Avatar size="lg">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    L
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left">
                  <span className="truncate text-sm font-medium">luqman</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {email || "—"}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/profil")}>
                <User className="size-4" />
                Maklumat Saya
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="size-4" />
                Tetapan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                Log Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b bg-background px-6 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((value) => !value)}
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="size-5" />
            </Button>
            <h1 className="text-xl font-semibold">{activeLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Pencapaian">
              <Award className="size-5 text-amber-400" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={isManager ? "Jana Kod QR" : "Imbas QR"}
              onClick={() =>
                isManager ? router.push("/qr-kehadiran") : setQrOpen(true)
              }
            >
              <QrCode className="size-5" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {!isManager && (
        <AttendanceQrSheet open={qrOpen} onOpenChange={setQrOpen} />
      )}
    </div>
  )
}
