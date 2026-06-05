'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, SkipForward, Clock, Target } from 'lucide-react'
import type { TaskWithGoal } from '@/lib/types'
import { categoryColors } from '@/lib/mock-data'
import { ConfettiPop } from './ConfettiPop'
import { Illo } from './Illo'
import { SPARKLES, pickRandom } from '@/lib/illustrations'
import { CATEGORY_ICON } from '@/lib/icons'

interface JustDoThisCardProps {
  tasks: TaskWithGoal[]
  onComplete?: (taskId: string) => void
  onSkip?: (taskId: string) => void
}

export function JustDoThisCard({ tasks, onComplete, onSkip }: JustDoThisCardProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const activeTasks = tasks.filter(t => !completedIds.has(t.id))
  const currentTask = activeTasks[0]
  const totalDone = completedIds.size

  useEffect(() => {
    if (currentTask) {
      setTimeLeft(currentTask.microTask.durationMin * 60)
    }
  }, [currentTask?.id])

  const handleSkip = useCallback(() => {
    if (!currentTask) return
    setCompletedIds(prev => new Set(prev).add(currentTask.id))
    onSkip?.(currentTask.microTask.id)
  }, [currentTask, onSkip])

  useEffect(() => {
    if (!currentTask || timeLeft <= 0) return
    const interval = setInterval(() => {
      // Stop at zero — never auto-skip. The task stays until she acts on it.
      setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentTask?.id, timeLeft > 0])

  const handleComplete = useCallback(() => {
    if (!currentTask) return
    setCompletedIds(prev => new Set(prev).add(currentTask.id))
    onComplete?.(currentTask.microTask.id)
    setShowConfetti(true)
    setShowSuccess(true)
    setTimeout(() => {
      setShowConfetti(false)
      setShowSuccess(false)
    }, 1500)
  }, [currentTask, onComplete])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = currentTask
    ? 1 - (timeLeft / (currentTask.microTask.durationMin * 60))
    : 0

  if (!currentTask && totalDone > 0) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-success-soft border border-success/20 rounded-3xl p-8 text-center"
      >
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="font-display text-2xl font-bold mb-1">You crushed it!</h2>
        <p className="text-muted text-sm">
          {totalDone} tasks done. Take a breath.
        </p>
      </motion.div>
    )
  }

  if (!currentTask) return null

  const color = categoryColors[currentTask.goal.category] || '#8B6F5E'
  const GoalIcon = CATEGORY_ICON[currentTask.goal.category] ?? Target

  return (
    <div className="relative">
      <ConfettiPop active={showConfetti} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentTask.id}
          initial={{ scale: 0.96, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: -16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative overflow-hidden rounded-3xl"
          style={{ backgroundColor: color }}
        >
          {/* Progress bar along top */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-black/10">
            <motion.div
              className="h-full bg-white/40"
              animate={{ width: `${progressPct * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <div className="p-6 pt-8 text-white min-h-[220px] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-1.5 text-sm font-semibold opacity-80 uppercase tracking-wider">
                <GoalIcon size={14} /> {currentTask.goal.title}
              </span>
              <span className="text-xs opacity-60 bg-white/10 px-2.5 py-1 rounded-full">
                {currentTask.microTask.phase}
              </span>
            </div>

            <h2 className="font-display text-3xl font-bold leading-tight mb-4 flex-1">
              {currentTask.microTask.title}
            </h2>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="opacity-70" />
                <span className="text-2xl font-bold tabular-nums">
                  {formatTime(timeLeft)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSkip}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Skip"
                >
                  <SkipForward size={18} />
                </button>
                <button
                  onClick={handleComplete}
                  className="p-3 rounded-full bg-white/25 hover:bg-white/35 transition-colors"
                  aria-label="Done"
                >
                  <Check size={20} strokeWidth={3} />
                </button>
              </div>
            </div>

          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center bg-success/90 rounded-3xl z-10"
          >
            <div className="text-center text-white">
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                className="mb-2"
              >
                <Illo src={pickRandom(SPARKLES)} className="h-20 w-auto mx-auto" />
              </motion.div>
              <p className="font-bold text-lg">Nice one!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {tasks.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {tasks.map((t) => (
            <div
              key={t.id}
              className={`rounded-full transition-all duration-300 ${
                completedIds.has(t.id)
                  ? 'w-2 h-2 bg-success'
                  : t.id === currentTask?.id
                  ? 'w-6 h-2 bg-foreground/60 rounded-full'
                  : 'w-2 h-2 bg-foreground/15'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
