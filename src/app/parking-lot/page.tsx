'use client'

import { useState } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { Send, Brain, Trash2, Pencil, Sparkles, Check, X, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useStore } from '@/lib/store'
import type { Goal, MicroTask, ParkingLotItem } from '@/lib/types'

let idSeq = 0
const uid = (p: string) => `${p}-${Date.now()}-${++idSeq}`

function DumpRow({
  item, apiKey, userContext, onEdit, onDelete, onMakeGoal,
}: {
  item: ParkingLotItem
  apiKey: string
  userContext: string
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onMakeGoal: (goal: Goal, tasks: MicroTask[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.rawText)
  const [busy, setBusy] = useState(false)

  const makeGoal = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: item.rawText, category: 'custom', lifeArea: 'personal', apiKey, userContext }),
      })
      const data = await res.json()
      const goalId = uid('goal')
      const goal: Goal = {
        id: goalId, title: data.goal?.title || item.rawText, description: '', category: 'custom',
        lifeArea: 'personal', priority: 3, progressPct: 0, createdAt: new Date().toISOString(),
        emoji: data.goal?.emoji || '📌',
      }
      const raw = (data.microTasks?.length ? data.microTasks : [{ title: item.rawText, durationMin: 10, phase: 'Do it' }])
      const tasks: MicroTask[] = raw.map((t: { title: string; durationMin?: number; phase?: string; energyLevel?: string; cognitiveLoad?: string }, i: number) => ({
        id: uid('mt'), goalId, title: t.title, durationMin: t.durationMin ?? 10,
        energyLevel: (t.energyLevel as MicroTask['energyLevel']) || 'medium', context: 'anywhere',
        cognitiveLoad: (t.cognitiveLoad as MicroTask['cognitiveLoad']) || 'light', toolsNeeded: [],
        phase: t.phase || 'Step', sequenceOrder: i + 1, status: 'pending',
      }))
      onMakeGoal(goal, tasks)
      onDelete(item.id)
    } catch {
      setBusy(false)
    }
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -90) onDelete(item.id)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 bg-card border border-today-ink/30 rounded-2xl px-3 py-2">
        <input
          autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { onEdit(item.id, draft.trim() || item.rawText); setEditing(false) } }}
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button onClick={() => { onEdit(item.id, draft.trim() || item.rawText); setEditing(false) }} className="p-1.5 text-success"><Check size={16} /></button>
        <button onClick={() => { setDraft(item.rawText); setEditing(false) }} className="p-1.5 text-muted"><X size={16} /></button>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* swipe-left reveal */}
      <div className="absolute inset-0 rounded-2xl bg-accent flex items-center justify-end pr-5">
        <Trash2 size={18} className="text-white" />
      </div>
      <motion.div
        layout
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        onDragEnd={onDragEnd}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -120 }}
        className="relative bg-card border border-card-border rounded-2xl px-4 py-3 flex items-center gap-3"
      >
        <Brain size={15} className="text-muted shrink-0" />
        <p className="flex-1 min-w-0 text-sm">{item.rawText}</p>
        <span className="hidden sm:block font-mono text-[10px] text-muted shrink-0">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={makeGoal} disabled={busy} title="Make it a goal" className="p-1.5 rounded-full text-today-ink hover:bg-today-tint transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          </button>
          <button onClick={() => setEditing(true)} title="Edit" className="p-1.5 rounded-full text-muted hover:bg-muted-light transition-colors"><Pencil size={14} /></button>
          <button onClick={() => onDelete(item.id)} title="Delete" className="p-1.5 rounded-full text-muted hover:bg-accent-soft hover:text-accent transition-colors"><Trash2 size={14} /></button>
        </div>
      </motion.div>
    </div>
  )
}

export default function ParkingLotPage() {
  const store = useStore()
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    store.addParkingLotItem(text.trim())
    setText('')
  }

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto px-5 md:px-8 pt-12">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Brain <span className="italic font-normal">dump</span></h1>
        <p className="text-sm text-muted mt-1">Get it out of your head. Swipe to clear, or tap the spark to turn one into a goal.</p>
      </div>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex items-center gap-2 bg-card border border-card-border rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-today-ink/30">
          <Brain size={18} className="text-muted shrink-0" />
          <input
            value={text} onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted" autoComplete="off"
          />
          <button type="submit" disabled={!text.trim()} className="p-1.5 bg-today-ink text-white rounded-full disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0">
            <Send size={14} />
          </button>
        </div>
      </form>

      {store.parkingLot.length === 0 ? (
        <p className="font-mono text-sm text-muted text-center py-10">nothing here. a clear head.</p>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {store.parkingLot.map((item) => (
              <DumpRow
                key={item.id} item={item}
                apiKey={store.settings.anthropicApiKey} userContext={store.settings.userContext}
                onEdit={store.editParkingLotItem} onDelete={store.deleteParkingLotItem} onMakeGoal={store.addGoal}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
