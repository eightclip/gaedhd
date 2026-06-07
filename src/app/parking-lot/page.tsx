'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Brain, Trash2, Pencil, Sparkles, Check, X, Loader2, ChevronDown, Plus, RotateCw } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { ParkingLotItem, DumpStep } from '@/lib/types'

// One editable step inside a dump's breakdown.
function StepRow({
  step, onEdit, onDelete,
}: {
  step: DumpStep
  onEdit: (title: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(step.title)

  const save = () => { onEdit(draft.trim() || step.title); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-2 pl-1">
        <input
          autoFocus value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(step.title); setEditing(false) } }}
          className="flex-1 bg-muted-light rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-today-ink/30"
        />
        <button onClick={save} className="p-1.5 text-success"><Check size={15} /></button>
        <button onClick={() => { setDraft(step.title); setEditing(false) }} className="p-1.5 text-muted"><X size={15} /></button>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2.5 py-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-today-ink/40 shrink-0" />
      <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left text-sm leading-snug hover:text-today-ink transition-colors">
        {step.title}
        {step.durationMin ? <span className="font-mono text-[10px] text-muted ml-1.5">{step.durationMin}m</span> : null}
      </button>
      <button onClick={() => setEditing(true)} className="p-1 text-muted/0 group-hover:text-muted hover:!text-today-ink transition-colors shrink-0"><Pencil size={13} /></button>
      <button onClick={onDelete} className="p-1 text-muted/0 group-hover:text-muted hover:!text-accent transition-colors shrink-0"><X size={14} /></button>
    </div>
  )
}

function DumpRow({
  item, onEditText, onDelete, onUpdateStep, onRemoveStep, onAddStep, onReprocess, onSpark,
}: {
  item: ParkingLotItem
  onEditText: (id: string, text: string) => void
  onDelete: (id: string) => void
  onUpdateStep: (itemId: string, stepId: string, title: string) => void
  onRemoveStep: (itemId: string, stepId: string) => void
  onAddStep: (itemId: string, title: string) => void
  onReprocess: (id: string) => void
  onSpark: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.rawText)
  const [newStep, setNewStep] = useState('')
  const [sparking, setSparking] = useState(false)

  const ready = item.status === 'ready' && (item.steps?.length ?? 0) > 0
  const stepCount = item.steps?.length ?? 0

  const addStep = () => { if (newStep.trim()) { onAddStep(item.id, newStep.trim()); setNewStep('') } }
  const spark = () => { setSparking(true); onSpark(item.id) }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -120 }}
      className="bg-card border border-card-border rounded-2xl overflow-hidden"
    >
      {/* header */}
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="shrink-0 text-base leading-none">{item.emoji || '🧠'}</span>
        {editing ? (
          <input
            autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { onEditText(item.id, draft.trim() || item.rawText); setEditing(false) } }}
            className="flex-1 bg-muted-light rounded-lg px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-today-ink/30"
          />
        ) : (
          <button
            onClick={() => ready && setExpanded(v => !v)}
            className="flex-1 min-w-0 text-left"
          >
            <p className="text-sm font-medium truncate">{item.rawText}</p>
            {item.source && !['telegram', 'api', 'app', 'photo'].includes(item.source) && (
              <span className="font-mono text-[10px] text-today-ink mt-0.5 block">💛 from {item.source.charAt(0).toUpperCase() + item.source.slice(1)}</span>
            )}
            {item.status === 'processing' && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted mt-0.5">
                <Loader2 size={11} className="animate-spin" /> breaking it into bite-size steps…
              </span>
            )}
            {ready && (
              <span className="font-mono text-[10px] text-muted mt-0.5 block">
                {stepCount} step{stepCount === 1 ? '' : 's'} · tap to {expanded ? 'hide' : 'see how'}
              </span>
            )}
            {item.status === 'error' && (
              <span className="font-mono text-[10px] text-accent mt-0.5 block">couldn&apos;t break that down</span>
            )}
          </button>
        )}

        {/* actions */}
        <div className="flex items-center gap-0.5 shrink-0">
          {ready && (
            <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-full text-today-ink hover:bg-today-tint transition-colors">
              <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
          {item.status === 'error' && (
            <button onClick={() => onReprocess(item.id)} title="Try again" className="p-1.5 rounded-full text-muted hover:bg-muted-light transition-colors"><RotateCw size={14} /></button>
          )}
          {!item.status && stepCount === 0 && (
            <button onClick={() => onReprocess(item.id)} title="Break it down" className="p-1.5 rounded-full text-today-ink hover:bg-today-tint transition-colors"><Sparkles size={14} /></button>
          )}
          <button onClick={() => { setDraft(item.rawText); setEditing(e => !e) }} title="Rename" className="p-1.5 rounded-full text-muted hover:bg-muted-light transition-colors"><Pencil size={13} /></button>
          <button onClick={() => onDelete(item.id)} title="Delete" className="p-1.5 rounded-full text-muted hover:bg-accent-soft hover:text-accent transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* breakdown dropdown */}
      <AnimatePresence initial={false}>
        {ready && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1" style={{ backgroundColor: 'var(--today-tint)' }}>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2 pt-2">How this gets done</p>
              <div className="space-y-0.5">
                {item.steps!.map(step => (
                  <StepRow
                    key={step.id}
                    step={step}
                    onEdit={(title) => onUpdateStep(item.id, step.id, title)}
                    onDelete={() => onRemoveStep(item.id, step.id)}
                  />
                ))}
              </div>

              {/* add a step */}
              <div className="flex items-center gap-2 mt-2 pl-1">
                <Plus size={14} className="text-muted shrink-0" />
                <input
                  value={newStep} onChange={e => setNewStep(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addStep() }}
                  placeholder="add a step…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                />
                {newStep.trim() && <button onClick={addStep} className="p-1 text-success"><Check size={15} /></button>}
              </div>

              {/* spark into her day */}
              <button
                onClick={spark}
                disabled={sparking}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-today-ink text-white rounded-full py-3 font-display font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {sparking ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Spark into my day
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function ParkingLotPage() {
  const store = useStore()
  const [text, setText] = useState('')
  const processing = useRef<Set<string>>(new Set())

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    store.addParkingLotItem(text.trim())
    setText('')
  }

  // Everything captured elsewhere (the Telegram bot, photos, quick-add) lands in
  // the append-only inbox; pull it into the dump so it all pools in one place.
  useEffect(() => {
    let cancelled = false
    fetch('/api/inbox')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d?.items?.length) return
        for (const it of d.items as { id: string; raw_text: string | null; source?: string }[]) {
          if (it.raw_text) store.addParkingLotItem(it.raw_text, it.source)
          fetch(`/api/inbox?id=${encodeURIComponent(it.id)}`, { method: 'DELETE' }).catch(() => {})
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [store.addParkingLotItem])

  // The moment a dump is added, break it into bite-size steps (server uses the
  // shared key, so it works even if she hasn't added her own).
  useEffect(() => {
    for (const item of store.parkingLot) {
      if (item.status !== 'processing' || processing.current.has(item.id)) continue
      processing.current.add(item.id)
      fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: item.rawText, category: 'custom', lifeArea: 'personal',
          apiKey: store.settings.anthropicApiKey, userContext: store.settings.userContext,
        }),
      })
        .then(r => r.json())
        .then(data => {
          const raw = (data.microTasks?.length ? data.microTasks : [{ title: item.rawText, durationMin: 10 }])
          const steps: DumpStep[] = raw.map((t: { title: string; durationMin?: number }, i: number) => ({
            id: `step-${Date.now()}-${i}`, title: t.title, durationMin: t.durationMin ?? 10,
          }))
          store.setDumpBreakdown(item.id, { status: 'ready', steps, emoji: data.goal?.emoji, title: data.goal?.title, sequential: data.sequential === true })
        })
        .catch(() => store.setDumpBreakdown(item.id, { status: 'error' }))
        .finally(() => processing.current.delete(item.id))
    }
  }, [store.parkingLot, store.settings.anthropicApiKey, store.settings.userContext, store.setDumpBreakdown])

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto px-5 md:px-8 pt-12">
      <div className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Brain <span className="italic font-normal">dump</span></h1>
        <p className="text-sm text-muted mt-1">Get it out of your head. I&apos;ll break each one into bite-size steps — edit them, then spark it into your day.</p>
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
                onEditText={store.editParkingLotItem}
                onDelete={store.deleteParkingLotItem}
                onUpdateStep={store.updateDumpStep}
                onRemoveStep={store.removeDumpStep}
                onAddStep={store.addDumpStep}
                onReprocess={store.reprocessDumpItem}
                onSpark={store.promoteDumpToGoal}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
