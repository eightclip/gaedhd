'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, X, Pencil, Trash2, Check } from 'lucide-react'
import { categoryColors } from '@/lib/mock-data'
import { categoryIcon } from '@/lib/icons'
import { Illo } from '@/components/Illo'
import { ILLO } from '@/lib/illustrations'
import { ProgressRing } from '@/components/ProgressRing'
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

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

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
        }),
      })
      const data = await res.json()
      if (!data.error) {
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
      }
    } catch {
      // fail silently — goal added without tasks if API is down
    } finally {
      setIsDecomposing(false)
      setShowInput(false)
      setGoalText('')
    }
  }

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setEditTitle(goal.title)
    setEditCategory(goal.category)
  }

  const handleSaveEdit = () => {
    if (!editingGoal || !editTitle.trim()) return
    store.editGoal(editingGoal.id, {
      title: editTitle.trim(),
      category: editCategory,
      emoji: getCategoryEmoji(editCategory),
    })
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
        <h1 className="font-display text-3xl font-bold">Goals</h1>
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
                <span className="text-sm font-bold">New Goal</span>
              </div>
              <button onClick={() => setShowInput(false)} className="text-muted p-1">
                <X size={18} />
              </button>
            </div>

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
                  Break it down for me
                </>
              )}
            </button>
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
                className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 mb-4"
                autoFocus
              />

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
                disabled={!editTitle.trim()}
                className="w-full py-3 bg-accent text-white rounded-2xl font-bold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Check size={16} />
                Save changes
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

      {/* Goal cards */}
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
        {store.goals.map((goal) => {
          const color = categoryColors[goal.category] || '#8B6F5E'
          const GoalIcon = categoryIcon(goal.category)
          const taskCount = store.microTasks.filter(t => t.goalId === goal.id).length
          const doneCount = store.microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length
          const isConfirmDelete = confirmDeleteId === goal.id

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4"
            >
              <ProgressRing progress={goal.progressPct} size={56} strokeWidth={6} color={color}>
                <GoalIcon size={20} style={{ color }} />
              </ProgressRing>

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
                  <span className="text-[10px] text-muted">
                    {doneCount}/{taskCount} steps
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
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
