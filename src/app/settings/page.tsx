'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Key, User, Clock, Trash2, ChevronLeft, Check, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useStore } from '@/lib/store'

export default function SettingsPage() {
  const store = useStore()
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    if (confirmReset) {
      store.resetData()
      setConfirmReset(false)
    } else {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-5 pt-12 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/chat" className="p-2 rounded-full bg-muted-light hover:bg-foreground/10 transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="font-display text-3xl font-bold">Settings</h1>
      </div>

      {/* API Key */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Key size={16} className="text-accent" />
          <h2 className="font-bold text-sm">AI Assistant</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-3">
            Add your Anthropic API key to enable the full AI chat experience.
            Without it, the chat uses smart built-in responses.
          </p>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={store.settings.anthropicApiKey}
              onChange={(e) => store.updateSettings({ anthropicApiKey: e.target.value })}
              placeholder="sk-ant-..."
              className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted pr-16"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-accent font-semibold px-2 py-1"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-accent mt-2 hover:underline"
          >
            Get an API key <ExternalLink size={10} />
          </a>
          {store.settings.anthropicApiKey && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-success">
              <Check size={12} />
              Key saved (stored locally, never sent to our servers)
            </div>
          )}
        </div>
      </section>

      {/* User Preferences */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Preferences</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
          <div>
            <label className="text-xs text-muted font-semibold block mb-1">Your Name</label>
            <input
              type="text"
              value={store.settings.userName}
              onChange={(e) => store.updateSettings({ userName: e.target.value })}
              placeholder="What should I call you?"
              className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted font-semibold block mb-1">
                <Clock size={10} className="inline mr-1" />
                Wake Time
              </label>
              <select
                value={store.settings.wakeHour}
                onChange={(e) => store.updateSettings({ wakeHour: parseInt(e.target.value) })}
                className="w-full bg-muted-light rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 5).map(h => (
                  <option key={h} value={h}>
                    {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted font-semibold block mb-1">
                <Clock size={10} className="inline mr-1" />
                Sleep Time
              </label>
              <select
                value={store.settings.sleepHour}
                onChange={(e) => store.updateSettings({ sleepHour: parseInt(e.target.value) })}
                className="w-full bg-muted-light rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 appearance-none"
              >
                {Array.from({ length: 8 }, (_, i) => i + 19).map(h => (
                  <option key={h} value={h}>
                    {h > 12 ? h - 12 : h}:00 {h >= 12 ? 'PM' : 'AM'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted font-semibold block mb-1">
              Transition Buffer (min between events)
            </label>
            <div className="flex items-center gap-3">
              {[2, 3, 5, 10].map(min => (
                <button
                  key={min}
                  onClick={() => store.updateSettings({ transitionBufferMin: min })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    store.settings.transitionBufferMin === min
                      ? 'bg-foreground text-background'
                      : 'bg-muted-light hover:bg-foreground/10'
                  }`}
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Data */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Data</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-3">
            All data is stored locally in your browser. Nothing is sent to any server
            (except chat messages to the Claude API if you add a key).
          </p>
          <div className="text-xs text-muted mb-3 space-y-1">
            <p>📋 {store.goals.length} goals</p>
            <p>✅ {store.microTasks.filter(t => t.status === 'completed').length}/{store.microTasks.length} micro-tasks</p>
            <p>💬 {store.chatMessages.length} chat messages</p>
            <p>📝 {store.parkingLot.length} parking lot items</p>
          </div>
          <button
            onClick={handleReset}
            className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
              confirmReset
                ? 'bg-red-500 text-white'
                : 'bg-muted-light text-foreground hover:bg-foreground/10'
            }`}
          >
            {confirmReset ? 'Tap again to confirm reset' : 'Reset all data'}
          </button>
        </div>
      </section>

      {/* Version */}
      <p className="text-center text-xs text-muted mt-8">
        GaeDHD v0.1.0 · Made with 💛 for ADHD brains
      </p>
    </div>
  )
}
