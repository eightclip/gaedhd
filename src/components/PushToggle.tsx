'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, Check } from 'lucide-react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type Detect = { supported: boolean | null; standalone: boolean }

// "Notifications on this device" — she flips this on after the gift is revealed.
// Web push on iOS only works once the app is added to the Home Screen, so we
// detect that and guide her instead of failing silently.
export function PushToggle() {
  const [detect, setDetect] = useState<Detect>({ supported: null, standalone: true })
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Feature + install detection has to read window/navigator, so it runs once on
  // mount. Keeping supported=null until then matches the server render (no markup
  // mismatch); the async subscription check updates state from its callback.
  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount/feature detection
    setDetect({ supported: ok && !!VAPID_PUBLIC_KEY, standalone: isStandalone })
    if (ok) {
      navigator.serviceWorker
        .getRegistration()
        .then(reg => reg?.pushManager.getSubscription().then(sub => setSubscribed(!!sub)))
    }
  }, [])

  const enable = async () => {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setError('Notifications were blocked. Turn them on for this site in your browser settings.')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      })
      if (!res.ok) throw new Error("Couldn't turn these on right now. Try again in a minute.")
      setSubscribed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong turning these on.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    setBusy(true)
    setError(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setTested(false)
    } finally {
      setBusy(false)
    }
  }

  const sendTest = async () => {
    setBusy(true)
    try {
      await fetch('/api/push/test', { method: 'POST' })
      setTested(true)
    } finally {
      setBusy(false)
    }
  }

  if (detect.supported === null) return null

  if (!detect.supported) {
    return (
      <div className="bg-card border border-card-border rounded-2xl p-4">
        <p className="text-xs text-muted">Push notifications aren&apos;t available in this browser yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      <div className="flex items-center gap-3">
        {subscribed ? <Bell size={18} className="text-today-ink shrink-0" /> : <BellOff size={18} className="text-muted shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-bold">Notifications on this device</p>
          <p className="text-[11px] text-muted">
            {subscribed ? 'On. Nudges land here, including the ones tied to where you are.' : 'Get your nudges as notifications on this phone.'}
          </p>
        </div>
        {subscribed ? (
          <button onClick={disable} disabled={busy} className="text-xs font-semibold text-muted px-3 py-1.5 rounded-full hover:bg-muted-light disabled:opacity-40">
            Turn off
          </button>
        ) : (
          <button onClick={enable} disabled={busy || !detect.standalone} className="text-xs font-bold text-white bg-today-ink px-3 py-1.5 rounded-full hover:opacity-90 disabled:opacity-40">
            {busy ? '...' : 'Turn on'}
          </button>
        )}
      </div>

      {!detect.standalone && !subscribed && (
        <p className="mt-3 text-[11px] text-muted leading-relaxed">
          On iPhone, add GaeDHD to your Home Screen first: tap the Share button, then &ldquo;Add to Home Screen.&rdquo; Open it from there and this turns on.
        </p>
      )}

      {subscribed && (
        <button onClick={sendTest} disabled={busy} className="mt-3 flex items-center gap-1.5 text-xs text-today-ink font-semibold hover:underline disabled:opacity-40">
          {tested ? <><Check size={13} /> Test sent</> : 'Send a test notification'}
        </button>
      )}

      {error && <p className="mt-3 text-[11px] text-accent">{error}</p>}
    </div>
  )
}
