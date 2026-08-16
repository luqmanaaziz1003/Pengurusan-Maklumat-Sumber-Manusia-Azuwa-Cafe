"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { CheckCircle2, ScanLine } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

function ScannerPanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  function stopCamera() {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function handleDecoded(token: string) {
    if (doneRef.current) return
    doneRef.current = true
    stopCamera()
    setChecking(true)

    const { error } = await supabase.rpc("check_in_with_qr_token", {
      scanned_token: token,
    })

    setChecking(false)
    if (error) {
      setError(error.message)
      return
    }
    setResult("Kehadiran anda telah direkodkan.")
  }

  useEffect(() => {
    let active = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        })
        if (!active) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()
        tick()
      } catch {
        if (active) setError("Tidak dapat mengakses kamera peranti anda.")
      }
    }

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || doneRef.current) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code?.data) {
            handleDecoded(code.data)
            return
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    startCamera()
    return () => {
      active = false
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-1 flex-col items-center gap-4 overflow-y-auto px-4 py-2">
      {result ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="size-10 text-green-600" />
          <p className="text-sm font-medium text-green-700">{result}</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted-foreground underline"
          >
            Tutup
          </button>
        </div>
      ) : (
        <>
          <div className="relative flex aspect-square w-full max-w-72 items-center justify-center overflow-hidden rounded-lg border bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-primary/80" />
          </div>
          <p className="text-sm text-muted-foreground">
            {checking
              ? "Mengesahkan kehadiran…"
              : "Halakan kamera ke kod QR yang dipaparkan oleh pengurus."}
          </p>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}

export default function AttendanceQrSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ScanLine className="size-4" />
            Imbas Kehadiran
          </SheetTitle>
          <SheetDescription>
            Imbas kod QR yang dipaparkan oleh pengurus.
          </SheetDescription>
        </SheetHeader>

        {open && <ScannerPanel onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}
