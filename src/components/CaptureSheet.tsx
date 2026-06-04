'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Plus, Sparkles } from 'lucide-react'
import type { Goal, MicroTask } from '@/lib/types'
import { Illo } from './Illo'
import { ILLO } from '@/lib/illustrations'

interface InboxItem { id: string; raw_text: string | null; source: string }

interface CaptureSheetProps {
  open: boolean
  onClose: () => void
  apiKey: string
  userContext: string
  onAddGoal: (goal: Goal, tasks: MicroTask[]) => void
  inboxItems?: InboxItem[]
  onProcessed?: (id: string) => void
}

interface ParsedItem {
  text: string
  kind: 'task' | 'project'
  include: boolean
}

let idSeq = 0
function uid(prefix: string) {
  idSeq += 1
  return `${prefix}-${Date.now()}-${idSeq}`
}

// Build a one-step goal for a standalone task, so it surfaces as a next-action.
function quickGoal(text: string): { goal: Goal; tasks: MicroTask[] } {
  const goalId = uid('goal')
  const goal: Goal = {
    id: goalId,
    title: text,
    description: '',
    category: 'custom',
    lifeArea: 'personal',
    priority: 3,
    progressPct: 0,
    createdAt: new Date().toISOString(),
    emoji: '✅',
  }
  const tasks: MicroTask[] = [{
    id: uid('mt'),
    goalId,
    title: text,
    durationMin: 10,
    energyLevel: 'medium',
    context: 'anywhere',
    cognitiveLoad: 'light',
    toolsNeeded: [],
    phase: 'Do it',
    sequenceOrder: 1,
    status: 'pending',
  }]
  return { goal, tasks }
}

export function CaptureSheet({ open, onClose, apiKey, userContext, onAddGoal, inboxItems = [], onProcessed }: CaptureSheetProps) {
  const [quick, setQuick] = useState('')
  const [items, setItems] = useState<ParsedItem[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setQuick('')
    setItems([])
    setError(null)
    setBusy(false)
  }, [])

  const close = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handlePhoto = useCallback((file: File) => {
    setError(null)
    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await fetch('/api/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: reader.result, apiKey, userContext }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data.error || 'Could not read that photo')
        } else if (!data.items?.length) {
          setError("Could not find any items in that photo. Try a clearer shot.")
        } else {
          setItems(data.items.map((i: { text: string; kind?: string }) => ({
            text: i.text,
            kind: i.kind === 'project' ? 'project' : 'task',
            include: true,
          })))
        }
      } catch {
        setError('Something went wrong reading the photo')
      } finally {
        setBusy(false)
      }
    }
    reader.onerror = () => { setError('Could not read that file'); setBusy(false) }
    reader.readAsDataURL(file)
  }, [apiKey, userContext])

  // Turn a project line into a real broken-down goal; fall back to a quick goal.
  const addProject = useCallback(async (text: string) => {
    try {
      const res = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: text, category: 'custom', lifeArea: 'personal', apiKey, userContext }),
      })
      const data = await res.json()
      if (res.ok && data.microTasks?.length) {
        const goalId = uid('goal')
        const goal: Goal = {
          id: goalId,
          title: data.goal?.title || text,
          description: '',
          category: 'custom',
          lifeArea: 'personal',
          priority: 3,
          progressPct: 0,
          createdAt: new Date().toISOString(),
          emoji: data.goal?.emoji || '📌',
        }
        const tasks: MicroTask[] = data.microTasks.map((t: { title: string; durationMin?: number; phase?: string; energyLevel?: string; cognitiveLoad?: string }, i: number) => ({
          id: uid('mt'),
          goalId,
          title: t.title,
          durationMin: t.durationMin ?? 10,
          energyLevel: (t.energyLevel as MicroTask['energyLevel']) || 'medium',
          context: 'anywhere' as const,
          cognitiveLoad: (t.cognitiveLoad as MicroTask['cognitiveLoad']) || 'light',
          toolsNeeded: [],
          phase: t.phase || 'Step',
          sequenceOrder: i + 1,
          status: 'pending' as const,
        }))
        onAddGoal(goal, tasks)
        return
      }
    } catch {
      // fall through to quick goal
    }
    const q = quickGoal(text)
    onAddGoal(q.goal, q.tasks)
  }, [apiKey, userContext, onAddGoal])

  const addParsedItems = useCallback(async () => {
    setBusy(true)
    for (const item of items.filter(i => i.include)) {
      if (item.kind === 'project') {
        await addProject(item.text)
      } else {
        const q = quickGoal(item.text)
        onAddGoal(q.goal, q.tasks)
      }
    }
    setBusy(false)
    close()
  }, [items, addProject, onAddGoal, close])

  const addQuick = useCallback(async () => {
    const text = quick.trim()
    if (!text) return
    const q = quickGoal(text)
    onAddGoal(q.goal, q.tasks)
    setQuick('')
    close()
  }, [quick, onAddGoal, close])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="fixed inset-x-0 bottom-0 z-[61] bg-background rounded-t-3xl border-t border-card-border max-w-lg mx-auto max-h-[88vh] overflow-y-auto pb-safe"
          >
            <div className="sticky top-0 bg-background px-5 pt-4 pb-3 flex items-center justify-between border-b border-card-border">
              <h2 className="font-display text-2xl font-bold">Capture</h2>
              <button onClick={close} className="p-2 rounded-full hover:bg-muted-light" aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Inbox: captures sent in from the Telegram bot, email, or John */}
              {inboxItems.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-today-ink mb-2">
                    Sent to your list ({inboxItems.length})
                  </p>
                  <div className="space-y-2">
                    {inboxItems.map(it => (
                      <div key={it.id} className="flex items-center gap-2 bg-today-tint rounded-2xl px-3 py-2.5">
                        <span className="flex-1 text-sm font-medium min-w-0">{it.raw_text}</span>
                        <span className="text-[10px] font-mono text-muted uppercase shrink-0">{it.source}</span>
                        <button
                          onClick={() => { const q = quickGoal(it.raw_text || ''); onAddGoal(q.goal, q.tasks); onProcessed?.(it.id) }}
                          className="shrink-0 px-3 py-1.5 rounded-full bg-today-ink text-white text-xs font-bold"
                        >
                          Add
                        </button>
                        <button onClick={() => onProcessed?.(it.id)} className="shrink-0 p-1.5 rounded-full hover:bg-black/5" aria-label="Dismiss">
                          <X size={16} className="text-muted" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick text capture */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Jot a quick one</p>
                <div className="flex gap-2">
                  <input
                    value={quick}
                    onChange={e => setQuick(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addQuick() }}
                    placeholder="Buy milk, call the painter..."
                    className="flex-1 bg-card border border-card-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-today-ink/40"
                  />
                  <button
                    onClick={addQuick}
                    disabled={!quick.trim()}
                    className="px-4 rounded-2xl bg-today-ink text-white font-semibold disabled:opacity-40"
                  >
                    <Plus size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Photo of a list */}
              {items.length === 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Snap a list</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f) }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={busy}
                    className="w-full flex flex-col items-center gap-2 bg-card border border-dashed border-card-border rounded-3xl py-8 hover:border-today-ink/40 transition-colors"
                  >
                    {busy ? (
                      <><Loader2 size={28} className="animate-spin text-today-ink" /><span className="text-sm text-muted">Reading your list...</span></>
                    ) : (
                      <><Illo src={ILLO.snapList} className="h-16 w-auto mb-1" /><span className="text-sm font-semibold">Take or upload a photo</span><span className="text-xs text-muted">She writes it, the app reads it</span></>
                    )}
                  </button>
                </div>
              )}

              {/* Parsed items review */}
              {items.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">
                    Found {items.length} {items.length === 1 ? 'item' : 'items'}
                  </p>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setItems(prev => prev.map((it, j) => j === i ? { ...it, include: !it.include } : it))}
                        className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-left border transition-colors ${item.include ? 'bg-card border-today-ink/30' : 'bg-muted-light border-transparent opacity-50'}`}
                      >
                        <span className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${item.include ? 'bg-today-ink border-today-ink text-white' : 'border-muted'}`}>
                          {item.include && <span className="text-[11px] font-bold">✓</span>}
                        </span>
                        <span className="flex-1 text-sm font-medium">{item.text}</span>
                        {item.kind === 'project' && (
                          <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase text-today-ink bg-today-tint px-2 py-0.5 rounded-full">
                            <Sparkles size={10} /> project
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={addParsedItems}
                    disabled={busy || !items.some(i => i.include)}
                    className="w-full mt-4 bg-today-ink text-white font-bold rounded-2xl py-3.5 disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <>Add to my list</>}
                  </button>
                </div>
              )}

              {error && <p className="text-sm text-accent bg-accent-soft rounded-2xl px-4 py-3">{error}</p>}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
