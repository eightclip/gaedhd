'use client'

import { motion, AnimatePresence } from 'framer-motion'

const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  color: ['#C85D3E', '#7B9E6B', '#D4845E', '#9B7EC8', '#6BA3BE', '#FFD700'][i % 6],
  angle: (i / 24) * 360,
  distance: 60 + Math.random() * 80,
  size: 4 + Math.random() * 6,
  delay: Math.random() * 0.15,
}))

export function ConfettiPop({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center overflow-visible">
          {PARTICLES.map((p) => {
            const rad = (p.angle * Math.PI) / 180
            const endX = Math.cos(rad) * p.distance
            const endY = Math.sin(rad) * p.distance
            return (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: endX,
                  y: endY + 30, // gravity
                  scale: [0, 1.2, 0.8],
                  opacity: [1, 1, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: p.delay,
                  ease: 'easeOut',
                }}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                }}
              />
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
