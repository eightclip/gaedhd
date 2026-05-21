'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Brain, Check, Sparkles } from 'lucide-react'
import { parkingLotItems } from '@/lib/mock-data'
import { formatDistanceToNow } from 'date-fns'

export default function ParkingLotPage() {
  const [items, setItems] = useState(parkingLotItems)
  const [text, setText] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setItems(prev => [{
      id: `pl-${Date.now()}`,
      rawText: text.trim(),
      processed: false,
      createdAt: new Date().toISOString(),
    }, ...prev])
    setText('')
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-12">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">Parking Lot</h1>
        <p className="text-sm text-muted mt-1">
          Dump anything here. AI will sort it later.
        </p>
      </div>

      {/* Quick capture input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <div className="flex items-center gap-2 bg-card border border-card-border rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-accent/30">
            <Brain size={18} className="text-muted shrink-0" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What's on your mind?"
              className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="p-1.5 bg-accent text-white rounded-full disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </form>

      {/* Items */}
      <div className="space-y-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className={`bg-card border border-card-border rounded-2xl px-4 py-3 ${
                item.processed ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 p-1 rounded-full shrink-0 ${
                  item.processed ? 'bg-success-soft' : 'bg-accent-soft'
                }`}>
                  {item.processed ? (
                    <Check size={12} className="text-success" />
                  ) : (
                    <Sparkles size={12} className="text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.processed ? 'line-through text-muted' : ''}`}>
                    {item.rawText}
                  </p>
                  <p className="text-[10px] text-muted mt-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    {item.processed && ' · sorted into a goal'}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
