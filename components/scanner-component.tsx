"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Scan, Loader2 } from "lucide-react"

interface ScannerComponentProps {
  onScanned: (files: File[]) => void
}

export function ScannerComponent({ onScanned }: ScannerComponentProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scannerAvailable, setScannerAvailable] = useState(false)

  // Method 1: Using Dynamic Web TWAIN (requires license)
  const scanWithDWT = async () => {
    try {
      setIsScanning(true)
      setError(null)

      // This would initialize DWT scanner
      // const DWObject = await Dynamsoft.DWT.Load()
      // await DWObject.SelectSource()
      // await DWObject.AcquireImage()

      // For now, show instructions
      alert("Dynamic Web TWAIN сկաների համար անհրաժեշտ է լիցենզիա:\nhttps://www.dynamsoft.com/web-twain/overview/")

    } catch (err) {
      setError("Սկանավորման սխալ")
    } finally {
      setIsScanning(false)
    }
  }

  // Method 2: Using getUserMedia for camera/document scanner
  const scanWithCamera = async () => {
    try {
      setIsScanning(true)
      setError(null)

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      })

      // Create video element to capture
      const video = document.createElement('video')
      video.srcObject = stream
      video.play()

      // Wait for video to be ready
      await new Promise(resolve => {
        video.onloadedmetadata = resolve
      })

      // Create canvas to capture frame
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')

      if (ctx) {
        ctx.drawImage(video, 0, 0)

        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' })
            onScanned([file])
          }

          // Stop camera
          stream.getTracks().forEach(track => track.stop())
          setIsScanning(false)
        }, 'image/jpeg', 0.95)
      }

    } catch (err) {
      console.error(err)
      setError("Տեսախցիկին միանալու սխալ")
      setIsScanning(false)
    }
  }

  // Method 3: Using file input with capture attribute (mobile)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      onScanned(files)
    }
  }

  // Check if scanner/camera is available
  useEffect(() => {
    const checkMediaDevices = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          setScannerAvailable(true)
        }
      } catch (error) {
        setScannerAvailable(false)
      }
    }
    checkMediaDevices()
  }, [])

  return (
    <div className="space-y-4">
      {/* Method 1: Camera/Document Scanner */}
      <Button
        type="button"
        variant="outline"
        onClick={scanWithCamera}
        disabled={isScanning || !scannerAvailable}
        className="w-full h-24 flex flex-col gap-2"
      >
        {isScanning ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Սկանավորում...</span>
          </>
        ) : (
          <>
            <Scan className="h-8 w-8" />
            <span>Սկանավորել տեսախցիկով</span>
          </>
        )}
      </Button>

      {/* Method 2: Mobile capture */}
      <div className="relative">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          multiple
        />
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 flex flex-col gap-2 pointer-events-none"
        >
          <Scan className="h-8 w-8" />
          <span>Լուսանկարել փաստաթուղթը</span>
        </Button>
      </div>

      {/* Method 3: Professional Scanner (DWT) */}
      <Button
        type="button"
        variant="outline"
        onClick={scanWithDWT}
        className="w-full h-24 flex flex-col gap-2"
      >
        <Scan className="h-8 w-8" />
        <span>Պրոֆեսիոնալ սկաներ</span>
      </Button>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!scannerAvailable && (
        <p className="text-xs text-muted-foreground text-center">
          Տեսախցիկը հասանելի չէ այս բրաուզերում
        </p>
      )}
    </div>
  )
}
