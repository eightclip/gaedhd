'use client'

import { motion } from 'framer-motion'
import { Flame, Trophy, Clock, CheckCircle2 } from 'lucide-react'
import { categoryColors } from '@/lib/mock-data'
import { categoryIcon } from '@/lib/icons'
import { ProgressRing } from '@/components/ProgressRing'
import { useStore } from '@/lib/store'

export default function ProgressPage() {
  const store = useStore()

  const totalTasks = store.microTasks.length
  const completedTasks = store.microTasks.filter(t => t.status === 'completed').length
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const totalMinutes = store.microTasks
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.durationMin, 0)

  return (
    <div className="max-w-lg md:max-w-2xl mx-auto px-5 md:px-8 pt-12">
      <h1 className="font-display text-3xl font-bold mb-6">Progress</h1>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center mb-8"
      >
        <ProgressRing progress={overallProgress} size={160} strokeWidth={14} color="#C85D3E">
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold">{overallProgress}%</p>
            <p className="text-xs text-muted">overall</p>
          </div>
        </ProgressRing>
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-accent-soft rounded-2xl p-4 text-center"
        >
          <Flame size={20} className="text-accent mx-auto mb-1" />
          <p className="text-2xl font-extrabold">{store.streak}</p>
          <p className="text-[10px] text-muted font-semibold uppercase">day streak</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-success-soft rounded-2xl p-4 text-center"
        >
          <CheckCircle2 size={20} className="text-success mx-auto mb-1" />
          <p className="text-2xl font-extrabold">{completedTasks}</p>
          <p className="text-[10px] text-muted font-semibold uppercase">done</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-muted-light rounded-2xl p-4 text-center"
        >
          <Clock size={20} className="text-muted mx-auto mb-1" />
          <p className="text-2xl font-extrabold">{totalMinutes}m</p>
          <p className="text-[10px] text-muted font-semibold uppercase">total</p>
        </motion.div>
      </div>

      <p className="text-xs font-bold uppercase tracking-widest text-muted mb-3">
        Goal Breakdown
      </p>

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
