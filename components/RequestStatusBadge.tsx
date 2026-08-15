import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// Shared request statuses (leave & salary-advance) stored as status text.
const STATUS: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Menunggu Kelulusan",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  approved: {
    label: "Diluluskan",
    className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  },
  rejected: {
    label: "Ditolak",
    className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  },
}

export function RequestStatusBadge({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, className: "" }
  return <Badge className={cn(meta.className)}>{meta.label}</Badge>
}
