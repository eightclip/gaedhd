'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { Check, SkipForward, Clock, ChevronLeft } from 'lucide-react'
import type { ScheduledTask } from '@/lib/types'
import { categoryColors } from '@/lib/mock-data'
import { ConfettiPop } from './ConfettiPop'

interface JustDoThisCardProps {
  tasks: ScheduledTask[]
}

export function JustDoThisCard({ tasks }: JustDoThisCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Get active (non-completed, non-skipped) tasks
  const activeTasks = tasks.filter(t => !completedIds.has(t.id))
  const currentTask = activeTasks[0]
  const totalDone = completedIds.size

  // Reset timer when task changes
  useEffect(() => {
    if (currentTask) {
      setTimeLeft(currentTask.microTask.durationMin * 60)
    }
  }, [currentTask?.id])

  // Countdown
  useEffect(() => {
    if (!currentTask || timeLeft <= 0) return
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — auto advance (no guilt!)
          handleSkip()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [currentTask?.id, timeLeft > 0])

  const handleComplete = useCallback(() => {
    if (!currentTask) return
    setCompletedIds(prev => new Set(prev).add(currentTask.id))
    setShowConfetti(true)
    setShowSuccess(true)
    setTimeout(() => {
      setShowConfetti(false)
      setShowSuccess(false)
    }, 1500)
  }, [currentTask])

  const handleSkip = useCallback(() => {
    if (!currentTask) return
    // Skip silently — no guilt, just move on
    setCompletedIds(prev => new Set(prev).add(currentTask.id))
  }, [currentTask])

  // Swipe gesture
  const x = useMotionValue(0)
  const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5])
  const bgColor = useTransform(
    x,
    [-150, -50, 0, 50, 150],
    ['#C85D3E', 'transparent', 'transparent', 'transparent', '#7B9E6B']
  )

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progressPct = currentTask
    ? 1 - (timeLeft / (currentTask.microTask.durationMin * 60))
    : 0

  if (!currentTask && activeTasks.length === 0 && totalDone > 0) {
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

  return (
    <div className="relative">
      <ConfettiPop active={showConfetti} />

      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentTask.id}
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, x: -200 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.3}
          onDragEnd={(_, info) => {
            if (info.offset.x > 100) handleComplete()
            else if (info.offset.x < -100) handleSkip()
          }}
          className="relative overflow-hidden rounded-3xl cursor-grab active:cursor-grabbing"
          style={{
            backgroundColor: color,
            x,
            opacity,
          }}
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
            {/* Goal label */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold opacity-80 uppercase tracking-wider">
                {currentTask.goal.emoji} {currentTask.goal.title}
              </span>
              <span className="text-xs opacity-60 bg-white/10 px-2.5 py-1 rounded-full">
                {currentTask.microTask.phase}
              </span>
            </div>

            {/* The task — BIG */}
            <h2 className="font-display text-3xl font-bold leading-tight mb-4 flex-1">
              {currentTask.microTask.title}
            </h2>

            {/* Timer + controls */}
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

            {/* Swipe hint */}
            <div className="mt-3 flex items-center justify-center gap-1.5 opacity-40 text-xs">
              <ChevronLeft size={12} className="animate-swipe-hint" />
              <span>swipe right = done · swipe left = skip</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Success overlay */}
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
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                className="text-6xl mb-2"
              >
                ✓
              </motion.div>
              <p className="font-bold text-lg">Nice one!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      {tasks.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {tasks.map((t, i) => (
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
