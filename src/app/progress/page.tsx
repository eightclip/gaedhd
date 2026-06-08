'use client'

import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { categoryColors } from '@/lib/mock-data'
import { categoryIcon } from '@/lib/icons'
import { ProgressRing } from '@/components/ProgressRing'
import { useStore } from '@/lib/store'
import { computeMomentum } from '@/lib/momentum'

export default function ProgressPage() {
  const store = useStore()

  const totalTasks = store.microTasks.length
  const completedTasks = store.microTasks.filter(t => t.status === 'completed').length
  const momentum = computeMomentum(store.activeDays)
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // Last 7 days of the optional evening mood check-in, oldest → newest.
  const MOOD_EMOJI = { rough: '😔', ok: '😌', good: '✨' } as const
  const moodWeek = Array.from({ length: 7 }, (_, i) => {
    const t = new Date()
    const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (6 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { key, day: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()], mood: store.moodLog[key] }
  })
  const hasMoods = moodWeek.some(m => m.mood)
  const totalMinutes = store.microTasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.durationMin, 0)

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto px-5 md:px-8 pt-12">
      <h1 className="font-display text-4xl font-bold tracking-tight mb-6">Your <span className="italic font-normal">progress</span></h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center mb-8"
      >
        <ProgressRing progress={overallProgress} size={160} strokeWidth={14} color="var(--today-ink)">
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold">{overallProgress}%</p>
            <p className="text-xs text-muted">overall</p>
          </div>
        </ProgressRing>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-10">
        <div className="rounded-[1.5rem] p-5 text-center" style={{ backgroundColor: 'var(--today-tint)' }}>
          <p className="font-display text-4xl font-extrabold leading-none text-today-ink">{momentum.streak}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">{momentum.weekCount}/7 this week</p>
        </div>
        <div className="rounded-[1.5rem] p-5 text-center bg-success-soft">
          <p className="font-display text-4xl font-extrabold leading-none text-success">{completedTasks}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">done</p>
        </div>
        <div className="rounded-[1.5rem] p-5 text-center bg-muted-light">
          <p className="font-display text-4xl font-extrabold leading-none">{totalMinutes}<span className="text-xl">m</span></p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mt-2">focused</p>
        </div>
      </div>

      {hasMoods && (
        <div className="rounded-[1.5rem] p-5 mb-10 bg-card border border-card-border">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-3">how this week felt</p>
          <div className="grid grid-cols-7 gap-1.5">
            {moodWeek.map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xl leading-none">{m.mood ? MOOD_EMOJI[m.mood] : '·'}</span>
                <span className="font-mono text-[9px] text-muted">{m.day}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="font-display text-2xl font-bold tracking-tight mb-4">Goal <span className="italic font-normal">breakdown</span></h2>

      {store.goals.length === 0 && (
        <div className="text-center py-12 text-muted">
          <p className="text-sm">Add some goals to track progress</p>
        </div>
      )}

      <div className="space-y-3">
        {store.goals.map((goal, i) => {
          const color = categoryColors[goal.category] || '#8B6F5E'
          const GoalIcon = categoryIcon(goal.category)
          const taskCount = store.microTasks.filter(t => t.goalId === goal.id).length
          const doneCount = store.microTasks.filter(t => t.goalId === goal.id && t.status === 'completed').length

          return (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              className="bg-card border border-card-border rounded-2xl p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <GoalIcon size={20} style={{ color }} />
                <div className="flex-1">
                  <h3 className="font-bold text-sm">{goal.title}</h3>
                  <p className="text-xs text-muted">{doneCount}/{taskCount} steps</p>
                </div>
                <span className="text-sm font-bold" style={{ color }}>
                  {goal.progressPct}%
                </span>
              </div>
              <div className="h-2 bg-muted-light rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goal.progressPct}%` }}
                  transition={{ duration: 0.8, delay: 0.2 + 0.1 * i }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 mb-8 text-center"
      >
        <Trophy size={24} className="text-accent mx-auto mb-2" />
        <p className="text-sm text-muted">
          Every tiny step counts. You&apos;re doing great.
        </p>
      </motion.div>
    </div>
  )
}
