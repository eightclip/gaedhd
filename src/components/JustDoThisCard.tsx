'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, SkipForward, Clock, Target, Pause, Zap } from 'lucide-react'
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
  onPause?: (taskId: string) => void
}

export function JustDoThisCard({ tasks, onComplete, onSkip, onPause }: JustDoThisCardProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [pausedIds, setPausedIds] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  // Consecutive skips without a completion. On the 2nd in a row we intercept with
  // a gentle reframe + a tiny-start offer instead of just letting her bounce off
  // the task — targets the ADHD avoidance loop / "I can't do this" thought.
  const [skipRun, setSkipRun] = useState(0)
  const [reframe, setReframe] = useState(false)
  // Tiny-first-step: shrink the entry to 2 minutes. Lowering activation energy to
  // start matters more than shrinking the whole task.
  const [tinyMode, setTinyMode] = useState(false)

  // Paused tasks step aside for now but stay pending — they come back later.
  const activeTasks = tasks.filter(t => !completedIds.has(t.id) && !pausedIds.has(t.id))
  const currentTask = activeTasks[0]
  const totalDone = completedIds.size

  useEffect(() => {
    if (currentTask) {
      setTinyMode(false)
      setReframe(false)
      setTimeLeft(currentTask.microTask.durationMin * 60)
    }
  }, [currentTask?.id])

  // Shrink the entry to a 2-minute start. "You can stop after" is the whole point.
  const handleStartTiny = useCallback(() => {
    setTinyMode(true)
    setReframe(false)
    setSkipRun(0)
    setTimeLeft(120)
  }, [])

  const handleSkip = useCallback(() => {
    if (!currentTask) return
    const nextRun = skipRun + 1
    // Second skip in a row → pause and offer the reframe rather than skipping.
    if (nextRun >= 2 && !reframe) {
      setReframe(true)
      return
    }
    setSkipRun(nextRun)
    setReframe(false)
    setCompletedIds(prev => new Set(prev).add(currentTask.id))
    onSkip?.(currentTask.microTask.id)
  }, [currentTask, onSkip, skipRun, reframe])

  // Pause: set this one aside for later. It stays pending (not done, not skipped)
  // so it comes back around — for when a quick task is running long.
  const handlePause = useCallback(() => {
    if (!currentTask) return
    setPausedIds(prev => new Set(prev).add(currentTask.id))
    onPause?.(currentTask.microTask.id)
  }, [currentTask, onPause])

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
    setSkipRun(0)
    setReframe(false)
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
              <span className="text-xs opacity-70 bg-white/10 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                {tinyMode ? <><Zap size={11} /> just 2 min</> : currentTask.microTask.phase}
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
                  onClick={handlePause}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Pause for later"
                  title="Running long? Pause it for later"
                >
                  <Pause size={18} />
                </button>
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

            {!tinyMode && (
              <button
                onClick={handleStartTiny}
                className="mt-4 self-start inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white transition-colors"
              >
                <Zap size={13} /> or just start — 2 minutes
              </button>
            )}
          </div>

          {/* Reframe: she's bounced off this twice. Soften it, offer a tiny start. */}
          <AnimatePresence>
            {reframe && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6"
                style={{ backgroundColor: color }}
              >
                <p className="font-display text-xl font-bold text-white">This one keeps getting pushed.</p>
                <p className="text-white/80 text-sm mt-1 max-w-xs">That&apos;s the ADHD, not you. Want to try just two minutes? You can stop after.</p>
                <div className="flex items-center gap-2.5 mt-5">
                  <button
                    onClick={handleStartTiny}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white text-foreground px-5 py-2.5 text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Zap size={15} /> Try 2 minutes
                  </button>
                  <button
                    onClick={handleSkip}
                    className="rounded-full bg-white/15 text-white px-5 py-2.5 text-sm font-semibold hover:bg-white/25 transition-colors"
                  >
                    Skip it
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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
