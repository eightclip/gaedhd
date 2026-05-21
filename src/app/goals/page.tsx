'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Sparkles, X } from 'lucide-react'
import { goals, categoryColors, microTasks } from '@/lib/mock-data'
import { ProgressRing } from '@/components/ProgressRing'
import type { GoalCategory, LifeArea } from '@/lib/types'

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

export default function GoalsPage() {
  const [showInput, setShowInput] = useState(false)
  const [goalText, setGoalText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<GoalCategory>('fitness')
  const [selectedArea, setSelectedArea] = useState<LifeArea>('personal')
  const [isDecomposing, setIsDecomposing] = useState(false)

  const handleSubmit = async () => {
    if (!goalText.trim()) return
    setIsDecomposing(true)
    // TODO: Call AI decomposition API
    await new Promise(r => setTimeout(r, 2000))
    setIsDecomposing(false)
    setShowInput(false)
    setGoalText('')
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold">Goals</h1>
        <button
          onClick={() => setShowInput(true)}
          className="p-2.5 bg-accent text-white rounded-full hover:opacity-90 transition-opacity"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Goal input overlay */}
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

            {/* Category pills */}
            <div className="mt-3">
              <p className="text-xs text-muted font-semibold mb-2">Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedCategory === cat.value
                        ? 'text-white'
                        : 'bg-muted-light text-foreground hover:bg-foreground/10'
                    }`}
                    style={selectedCategory === cat.value ? { backgroundColor: categoryColors[cat.value] } : {}}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Life area */}
            <div className="mt-3">
              <p className="text-xs text-muted font-semibold mb-2">Calendar</p>
              <div className="flex gap-2">
                {LIFE_AREAS.map((area) => (
                  <button
                    key={area.value}
                    onClick={() => setSelectedArea(area.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedArea === area.value
                        ? 'bg-foreground text-background'
                        : 'bg-muted-light text-foreground hover:bg-foreground/10'
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
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
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

      {/* Goal cards */}
      <div className="space-y-3">
        {goals.map((goal) => {
          const color = categoryColors[goal.category] || '#8B6F5E'
          const taskCount = microTasks.filter(t => t.goalId === goal.id).length
          const doneCount = microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4"
            >
              <ProgressRing progress={goal.progressPct} size={56} strokeWidth={6} color={color}>
                <span className="text-lg">{goal.emoji}</span>
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
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
