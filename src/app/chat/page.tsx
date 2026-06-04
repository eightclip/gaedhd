'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Plus, Check, Settings, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useStore, type ChatMessage } from '@/lib/store'
import { categoryColors } from '@/lib/mock-data'

export default function ChatPage() {
  const store = useStore()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [store.chatMessages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    store.addChatMessage(userMsg)
    setInput('')
    setIsLoading(true)

    try {
      // Build message history for API (last 10 messages for context)
      const history = [...store.chatMessages, userMsg]
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          apiKey: store.settings.anthropicApiKey || undefined,
          userContext: store.settings.userContext || undefined,
        }),
      })

      const data = await res.json()

      if (data.error) {
        store.addChatMessage({
          id: `msg-${Date.now()}-err`,
          role: 'assistant',
          content: `Hmm, something went wrong: ${data.error}\n\nYou can add your Anthropic API key in Settings to enable the full AI experience, or I'll use my built-in responses.`,
          createdAt: new Date().toISOString(),
        })
      } else {
        store.addChatMessage({
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: data.content,
          proposedGoal: data.proposedGoal || undefined,
          createdAt: new Date().toISOString(),
        })
      }
    } catch {
      store.addChatMessage({
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: "Sorry, I couldn't reach the server. Try again in a sec!",
        createdAt: new Date().toISOString(),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const hasApiKey = !!store.settings.anthropicApiKey

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Chat</h1>
          <p className="text-xs text-muted">
            {hasApiKey ? '✨ AI powered' : 'Smart replies · add API key in Settings for full AI'}
          </p>
        </div>
        <Link
          href="/settings"
          className="p-2 rounded-full bg-muted-light hover:bg-foreground/10 transition-colors"
        >
          <Settings size={18} className="text-muted" />
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <AnimatePresence initial={false}>
          {store.chatMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                {/* Message bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-foreground text-background rounded-br-md'
                      : 'bg-card border border-card-border rounded-bl-md'
                  }`}
                >
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-1.5' : ''}>
                      {line.startsWith('**') && line.endsWith('**')
                        ? <strong>{line.slice(2, -2)}</strong>
                        : line.startsWith('• ')
                        ? <span className="block pl-2">{line}</span>
                        : line || <br />
                      }
                    </p>
                  ))}
                </div>

                {/* Proposed goal card */}
                {msg.proposedGoal && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-2"
                  >
                    <div
                      className="rounded-2xl p-4 text-white"
                      style={{
                        backgroundColor:
                          categoryColors[msg.proposedGoal.category] || '#8B6F5E',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{msg.proposedGoal.emoji}</span>
                        <h3 className="font-bold">{msg.proposedGoal.title}</h3>
                      </div>

                      <div className="space-y-1 mb-3">
                        {msg.proposedGoal.tasks.map((task: { title: string; durationMin: number; phase: string }, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs opacity-90">
                            <div className="w-1 h-1 rounded-full bg-white/60 shrink-0" />
                            <span className="flex-1">{task.title}</span>
                            <span className="opacity-60">{task.durationMin}m</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs opacity-70 mb-3">
                        <span>
                          {msg.proposedGoal.tasks.reduce(
                            (sum: number, t: { durationMin: number }) => sum + t.durationMin,
                            0
                          )}{' '}
                          min total · {msg.proposedGoal.tasks.length} steps
                        </span>
                      </div>

                      {msg.accepted ? (
                        <div className="flex items-center gap-2 text-sm font-semibold opacity-90">
                          <Check size={16} />
                          Added to your goals!
                        </div>
                      ) : (
                        <button
                          onClick={() => store.acceptProposedGoal(msg.id)}
                          className="w-full py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={16} />
                          Add this goal
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-muted" />
              <span className="text-sm text-muted">thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-5 pb-3 pt-2 border-t border-card-border bg-background">
        <div className="flex items-center gap-2 bg-card border border-card-border rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-accent/30">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What do you need to get done?"
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted"
            autoComplete="off"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-accent text-white rounded-full disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
