'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, X, Pencil, Trash2, Check, CheckCircle2 } from 'lucide-react'
import { categoryColors } from '@/lib/mock-data'
import { categoryIcon } from '@/lib/icons'
import { Illo } from '@/components/Illo'
import { ILLO } from '@/lib/illustrations'
import { isGoalActive, stepsDone, pendingTasks } from '@/lib/goals'
import { useStore } from '@/lib/store'
import type { GoalCategory, LifeArea, Goal, MicroTask } from '@/lib/types'

const CATEGORIES: { value: GoalCategory; label: string; emoji: string }[] = [
  { value: 'fitness', label: 'Fitness', emoji: '💪' },
  { value: 'learning', label: 'Learning', emoji: '📚' },
  { value: 'art', label: 'Art', emoji: '🎨' },
  { value: 'home', label: 'Home', emoji: '🏠' },
  { value: 'work', label: 'Work', emoji: '💼' },
  { value: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦' },
  { value: 'self-care', label: 'Self Care', emoji: '🧘' },
  { value: 'relationships', label: 'People', emoji: '💬' },
  { value: 'errands', label: 'Errands', emoji: '🏃' },
]

const LIFE_AREAS: { value: LifeArea; label: string }[] = [
  { value: 'work', label: '💼 Work' },
  { value: 'family', label: '👨‍👩‍👧 Family' },
  { value: 'personal', label: '✨ Personal' },
]

function getCategoryEmoji(category: GoalCategory): string {
  return CATEGORIES.find(c => c.value === category)?.emoji ?? '✨'
}

export default function GoalsPage() {
  const store = useStore()

  // Add form
  const [showInput, setShowInput] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('fitness')
  const [selectedArea, setSelectedArea] = useState<LifeArea>('personal')
  const [isDecomposing, setIsDecomposing] = useState(false)

  // Edit modal
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<GoalCategory>('fitness')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Draft review (when help is faded to 'partial'/'prompt', the breakdown becomes
  // a draft SHE completes before it's saved — that's the point: she does the work).
  const [draft, setDraft] = useState<null | {
    title: string; emoji: string; sequential: boolean
    steps: { id: string; title: string }[]
    questions: string[]
  }>(null)

  const closeAddForm = () => {
    setIsDecomposing(false)
    setShowInput(false)
    setGoalText('')
    setDraft(null)
  }

  const handleSubmit = async () => {
    if (!goalText.trim()) return
    setIsDecomposing(true)
    try {
      const res = await fetch('/api/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: goalText,
          category: selectedCategory,
          lifeArea: selectedArea,
          apiKey: store.settings.anthropicApiKey || undefined,
          userContext: store.settings.userContext || undefined,
          helpLevel: store.settings.helpLevel,
        }),
      })
      const data = await res.json()
      if (data.error) { closeAddForm(); return }

      // A goal with no steps is born dead: it never appears in her day and never
      // reads as finished. Don't create one. (It still tops up later if it ever runs
      // dry, but there's no reason to start it empty.)
      if (data.coaching === 'full' && !(data.microTasks?.length > 0)) { closeAddForm(); return }

      // Faded help: hand her a draft to finish instead of auto-filling her day.
      if (data.coaching && data.coaching !== 'full') {
        const steps = (data.microTasks || []).map((t: { title: string }, i: number) => ({ id: `d-${i}`, title: t.title }))
        const minSlots = data.coaching === 'partial' ? steps.length + 1 : 2
        while (steps.length < minSlots) steps.push({ id: `d-${steps.length}`, title: '' })
        setDraft({
          title: data.goal.title || goalText,
          emoji: data.goal.emoji || getCategoryEmoji(selectedCategory),
          sequential: data.sequential === true,
          steps,
          questions: data.questions || [],
        })
        setIsDecomposing(false)
        return // keep the overlay open on the review editor
      }

      // Full help: auto-create with the AI's steps (original behavior).
      const goalId = `goal-${Date.now()}`
      const newGoal: Goal = {
        id: goalId,
        title: data.goal.title || goalText,
        description: goalText,
        category: selectedCategory,
        lifeArea: selectedArea,
        priority: 3,
        progressPct: 0,
        createdAt: new Date().toISOString(),
        emoji: data.goal.emoji || getCategoryEmoji(selectedCategory),
        sequential: data.sequential === true,
      }
      const newTasks: MicroTask[] = (data.microTasks || []).map(
        (t: { title: string; durationMin: number; phase: string; energyLevel: string; cognitiveLoad: string }, i: number) => ({
          id: `mt-${Date.now()}-${i}`,
          goalId,
          title: t.title,
          durationMin: t.durationMin,
          energyLevel: (t.energyLevel || 'medium') as MicroTask['energyLevel'],
          context: 'anywhere' as const,
          cognitiveLoad: (t.cognitiveLoad || 'light') as MicroTask['cognitiveLoad'],
          toolsNeeded: [],
          phase: t.phase,
          sequenceOrder: i + 1,
          status: 'pending' as const,
        })
      )
      store.addGoal(newGoal, newTasks)
      closeAddForm()
    } catch {
      closeAddForm() // fail silently — nothing saved if the API is down
    }
  }

  // She finished her own breakdown — save it as a goal.
  const handleConfirmDraft = () => {
    if (!draft) return
    const titles = draft.steps.map(s => s.title.trim()).filter(Boolean)
    if (titles.length === 0) return
    const goalId = `goal-${Date.now()}`
    const newGoal: Goal = {
      id: goalId,
      title: draft.title || goalText,
      description: goalText,
      category: selectedCategory,
      lifeArea: selectedArea,
      priority: 3,
      progressPct: 0,
      createdAt: new Date().toISOString(),
      emoji: draft.emoji || getCategoryEmoji(selectedCategory),
      sequential: draft.sequential,
    }
    const newTasks: MicroTask[] = titles.map((title, i) => ({
      id: `mt-${Date.now()}-${i}`,
      goalId,
      title,
      durationMin: 10,
      energyLevel: 'medium',
      context: 'anywhere',
      cognitiveLoad: 'light',
      toolsNeeded: [],
      phase: 'Step',
      sequenceOrder: i + 1,
      status: 'pending',
    }))
    store.addGoal(newGoal, newTasks)
    closeAddForm()
  }

  const updateDraftStep = (id: string, title: string) =>
    setDraft(d => d ? { ...d, steps: d.steps.map(s => s.id === id ? { ...s, title } : s) } : d)
  const addDraftStep = () =>
    setDraft(d => d ? { ...d, steps: [...d.steps, { id: `d-${Date.now()}`, title: '' }] } : d)
  const removeDraftStep = (id: string) =>
    setDraft(d => d ? { ...d, steps: d.steps.filter(s => s.id !== id) } : d)

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setEditTitle(goal.title)
    setEditCategory(goal.category)
  }

  const handleSaveEdit = async () => {
    if (!editingGoal || !editTitle.trim()) return
    const goalId = editingGoal.id
    const newTitle = editTitle.trim()
    const titleChanged = newTitle !== editingGoal.title

    store.editGoal(goalId, {
      title: newTitle,
      category: editCategory,
      emoji: getCategoryEmoji(editCategory),
    })

    // A more specific title deserves a matching breakdown — regenerate the steps.
    if (titleChanged) {
      setSavingEdit(true)
      try {
        const res = await fetch('/api/decompose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: newTitle,
            category: editCategory,
            lifeArea: editingGoal.lifeArea,
            apiKey: store.settings.anthropicApiKey || undefined,
            userContext: store.settings.userContext || undefined,
          }),
        })
        const data = await res.json()
        if (!data.error && data.microTasks?.length) {
          const tasks: MicroTask[] = data.microTasks.map(
            (t: { title: string; durationMin?: number; phase?: string; energyLevel?: string; cognitiveLoad?: string }, i: number) => ({
              id: `mt-${Date.now()}-${i}`,
              goalId,
              title: t.title,
              durationMin: t.durationMin ?? 10,
              energyLevel: (t.energyLevel || 'medium') as MicroTask['energyLevel'],
              context: 'anywhere' as const,
              cognitiveLoad: (t.cognitiveLoad || 'light') as MicroTask['cognitiveLoad'],
              toolsNeeded: [],
              phase: t.phase || 'Step',
              sequenceOrder: i + 1,
              status: 'pending' as const,
            })
          )
          store.replaceGoalTasks(goalId, tasks)
          store.editGoal(goalId, { sequential: data.sequential === true, ...(data.goal?.emoji ? { emoji: data.goal.emoji } : {}) })
        }
      } catch {
        // leave the existing steps in place if the rebuild fails
      } finally {
        setSavingEdit(false)
      }
    }
    setEditingGoal(null)
  }

  const handleDelete = (goalId: string) => {
    if (confirmDeleteId === goalId) {
      store.deleteGoal(goalId)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(goalId)
      setTimeout(() => setConfirmDeleteId(null), 3000)
    }
  }

  return (
    <div className="max-w-lg md:max-w-3xl mx-auto px-5 md:px-8 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Your <span className="italic font-normal">goals</span></h1>
        <button
          onClick={() => setShowInput(true)}
          className="p-2.5 bg-accent text-white rounded-full hover:opacity-90 transition-opacity"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Add goal overlay */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-card border border-card-border rounded-3xl p-5 mb-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-accent" />
                <span className="text-sm font-bold">{draft ? 'Your breakdown' : 'New Goal'}</span>
              </div>
              <button onClick={closeAddForm} className="text-muted p-1">
                <X size={18} />
              </button>
            </div>

            {!draft ? (
              <>
                <textarea
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  placeholder='Tell me what you want to do... "25 RDLs for the booty" or "learn basic Spanish"'
                  className="w-full bg-muted-light rounded-2xl px-4 py-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted"
                  autoFocus
                />

                <div className="mt-3">
                  <p className="text-xs text-muted font-semibold mb-2">Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selectedCategory === cat.value ? 'text-white' : 'bg-muted-light text-foreground hover:bg-foreground/10'
                        }`}
                        style={selectedCategory === cat.value ? { backgroundColor: categoryColors[cat.value] } : {}}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-muted font-semibold mb-2">Calendar</p>
                  <div className="flex gap-2">
                    {LIFE_AREAS.map((area) => (
                      <button
                        key={area.value}
                        onClick={() => setSelectedArea(area.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          selectedArea === area.value ? 'bg-foreground text-background' : 'bg-muted-light text-foreground hover:bg-foreground/10'
                        }`}
                      >
                        {area.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!goalText.trim() || isDecomposing}
                  className="w-full mt-4 py-3 bg-accent text-white rounded-2xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  {isDecomposing ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                        <Sparkles size={16} />
                      </motion.div>
                      Breaking it down...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      {store.settings.helpLevel === 'prompt' ? 'Help me think it through'
                        : store.settings.helpLevel === 'partial' ? 'Give me a starting point'
                        : 'Break it down for me'}
                    </>
                  )}
                </button>
              </>
            ) : (
              <div>
                <p className="text-sm font-bold mb-2">{draft.emoji} {draft.title}</p>
                {draft.questions.length > 0 && (
                  <div className="mb-3 rounded-2xl bg-muted-light p-3">
                    <p className="text-[11px] text-muted font-semibold mb-1.5">Think it through:</p>
                    <ul className="text-xs text-foreground/80 space-y-1 list-disc pl-4">
                      {draft.questions.map((q, i) => <li key={i}>{q}</li>)}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted font-semibold mb-2">Your steps — fill these in</p>
                <div className="space-y-2">
                  {draft.steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted w-4 shrink-0">{i + 1}</span>
                      <input
                        value={s.title}
                        onChange={(e) => updateDraftStep(s.id, e.target.value)}
                        placeholder="what's the next small step?"
                        className="flex-1 bg-muted-light rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted"
                      />
                      <button onClick={() => removeDraftStep(s.id)} className="text-muted p-1 hover:text-red-500 shrink-0" aria-label="Remove step">
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addDraftStep} className="mt-2 text-xs font-semibold text-accent flex items-center gap-1">
                  <Plus size={13} /> Add a step
                </button>
                <button
                  onClick={handleConfirmDraft}
                  disabled={!draft.steps.some(s => s.title.trim())}
                  className="w-full mt-4 py-3 bg-accent text-white rounded-2xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Check size={16} /> Add to my goals
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit modal */}
      <AnimatePresence>
        {editingGoal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-4"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingGoal(null) }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-card border border-card-border rounded-3xl p-5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-sm">Edit Goal</span>
                <button onClick={() => setEditingGoal(null)} className="text-muted p-1">
                  <X size={18} />
                </button>
              </div>

              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 mb-2"
                autoFocus
              />
              {editingGoal && editTitle.trim() !== editingGoal.title && (
                <p className="text-[11px] text-muted mb-4 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-accent" /> Saving rebuilds the steps to match your new wording.
                </p>
              )}
              {!(editingGoal && editTitle.trim() !== editingGoal.title) && <div className="mb-4" />}

              <p className="text-xs text-muted font-semibold mb-2">Category</p>
              <div className="flex flex-wrap gap-1.5 mb-5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setEditCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      editCategory === cat.value ? 'text-white' : 'bg-muted-light text-foreground hover:bg-foreground/10'
                    }`}
                    style={editCategory === cat.value ? { backgroundColor: categoryColors[cat.value] } : {}}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSaveEdit}
                disabled={!editTitle.trim() || savingEdit}
                className="w-full py-3 bg-accent text-white rounded-2xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {savingEdit ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Sparkles size={16} />
                    </motion.div>
                    Rebuilding steps...
                  </>
                ) : editingGoal && editTitle.trim() !== editingGoal.title ? (
                  <><Sparkles size={16} /> Save &amp; rebuild steps</>
                ) : (
                  <><Check size={16} /> Save changes</>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {store.goals.length === 0 && (
        <div className="text-center py-16 text-muted">
          <Illo src={ILLO.startList} className="h-20 w-auto mx-auto mb-3" />
          <p className="font-bold">No goals yet</p>
          <p className="text-sm mt-1">Tap + to add your first one</p>
        </div>
      )}

      {/* Goal cards — finished goals sink to the bottom */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {[...store.goals]
          // Finished goals sink to the bottom. "Finished" now means she or Claude
          // actually closed it, not that a batch of steps ran out.
          .sort((a, b) => (isGoalActive(a) ? 0 : 1) - (isGoalActive(b) ? 0 : 1))
          .map((goal) => {
          const color = categoryColors[goal.category] || '#8B6F5E'
          const GoalIcon = categoryIcon(goal.category)
          // Steps she has finished. Goals top up with fresh steps, so a "3/5" or a
          // percentage would slide backwards every time new ones arrive. This only
          // ever climbs.
          const done = stepsDone(goal.id, store.microTasks)
          const pending = pendingTasks(goal.id, store.microTasks).length
          const isConfirmDelete = confirmDeleteId === goal.id
          const isDone = !isGoalActive(goal)

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4 ${isDone ? 'opacity-60' : ''}`}
            >
              <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20' }}>
                <GoalIcon size={20} style={{ color }} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm">{goal.title}</h3>
                <p className="text-xs text-muted mt-0.5">{goal.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: color + '20', color }}
                  >
                    {goal.category}
                  </span>
                  {/* Lead with what's waiting for her. Counting only completed steps
                      made a topped-up goal read "0 steps done" and look dead. */}
                  <span className="text-[10px] text-muted">
                    {isDone
                      ? 'Done'
                      : pending > 0
                        ? `${pending} ready${done > 0 ? ` · ${done} done` : ''}`
                        : done > 0 ? `${done} ${done === 1 ? 'step' : 'steps'} done` : 'Not started yet'}
                  </span>
                </div>
                {/* Claude's plain sentence when it recognised the goal was finished. */}
                {isDone && goal.doneReason && (
                  <p className="text-[10px] text-muted mt-1 italic">{goal.doneReason}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => isDone ? store.reopenGoal(goal.id) : store.completeGoal(goal.id)}
                  className={`p-2 rounded-full transition-colors ${
                    isDone
                      ? 'bg-green-600 text-white'
                      : 'text-muted hover:text-green-600 hover:bg-green-50'
                  }`}
                  aria-label={isDone ? 'Reopen goal' : 'Mark goal complete'}
                  title={isDone ? 'Done — tap to reopen into your day' : 'Mark all steps done'}
                >
                  <CheckCircle2 size={15} />
                </button>
                <button
                  onClick={() => openEdit(goal)}
                  className="p-2 rounded-full text-muted hover:text-foreground hover:bg-muted-light transition-colors"
                  aria-label="Edit goal"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className={`p-2 rounded-full transition-colors ${
                    isConfirmDelete
                      ? 'bg-red-500 text-white'
                      : 'text-muted hover:text-red-500 hover:bg-red-50'
                  }`}
                  aria-label={isConfirmDelete ? 'Tap again to confirm' : 'Delete goal'}
                  title={isConfirmDelete ? 'Tap again to delete' : 'Delete'}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
