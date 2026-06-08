'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface WhereData {
  room: string | null
  lastRoom: string | null
  source: string | null
  updatedAt: string | null
}

const humanRoom = (r: string) => r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

// Source slug -> friendly label for "how we know."
const SOURCE_LABEL: Record<string, string> = {
  espresense: 'in-house beacon',
  geofence: 'phone geofence',
  app: 'manual pick',
  api: 'device',
}

// A room change within this window = "active". Beyond STALE_HRS with no change =
// likely offline. The middle is "idle" (could just be sitting in one room).
const FRESH_MIN = 15
const STALE_HRS = 3

type Status = 'active' | 'idle' | 'offline' | 'none'

// Presence status for Settings. Shows the last room the beacon (or geofence/manual
// pick) reported, how long ago, and a staleness indicator. Honest by design:
// presence only updates on a ROOM CHANGE, so a frozen time means "same room" OR
// "bridge offline" — we can't tell those apart from here (that needs the live
// signal view). Refreshes every 30s and on tab focus.
export function PresencePanel() {
  const [data, setData] = useState<WhereData | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Re-tick so "x minutes ago" stays fresh even without a refetch.
  const [, setTick] = useState(0)

  const load = useCallback(() => {
    fetch('/api/where')
      .then(r => (r.ok ? r.json() : null))
      .then((d: WhereData | null) => { setData(d); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    const tickId = setInterval(() => setTick(t => t + 1), 30_000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); clearInterval(tickId); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  const updatedAt = data?.updatedAt ? new Date(data.updatedAt) : null
  const ageMs = updatedAt ? Date.now() - updatedAt.getTime() : null

  let status: Status
  if (!updatedAt || !data?.lastRoom) status = 'none'
  else if (ageMs! < FRESH_MIN * 60_000) status = 'active'
  else if (ageMs! < STALE_HRS * 3_600_000) status = 'idle'
  else status = 'offline'

  const dotColor = { active: 'bg-emerald-500', idle: 'bg-amber-500', offline: 'bg-red-500', none: 'bg-zinc-400' }[status]
  const statusLabel = { active: 'Active', idle: 'Idle', offline: 'Likely offline', none: 'No signal yet' }[status]

  return (
    <div className="bg-card border border-card-border rounded-2xl p-4">
      {!loaded ? (
        <p className="text-xs text-muted">Checking presence…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className={`relative flex h-2.5 w-2.5`}>
              {status === 'active' && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`} />
            </span>
            <span className="text-sm font-bold">{statusLabel}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <MapPin size={18} className="text-today-ink shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {data?.lastRoom ? `In the ${humanRoom(data.lastRoom)}` : 'No room detected'}
              </p>
              <p className="text-xs text-muted truncate">
                {updatedAt ? `last seen ${formatDistanceToNow(updatedAt, { addSuffix: true })}` : 'never reported'}
                {data?.source ? ` · via ${SOURCE_LABEL[data.source] ?? data.source}` : ''}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            Presence updates only when she changes rooms, so a steady time can mean she&apos;s
            parked in one spot — not necessarily offline. A live per-room signal view is a future add.
          </p>
        </>
      )}
    </div>
  )
}
