'use client'

import { useState } from 'react'
import { Key, User, Clock, Trash2, ChevronLeft, Check, ExternalLink, Calendar, Plus, X, Sparkles, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useStore, detectCalendarType } from '@/lib/store'

export default function SettingsPage() {
  const store = useStore()
  const [showKey, setShowKey] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [calName, setCalName] = useState('')
  const [calUrl, setCalUrl] = useState('')

  const handleAddCalendar = () => {
    if (!calUrl.trim()) return
    store.addCalendarSource(calName, calUrl)
    setCalName('')
    setCalUrl('')
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
    <div className="max-w-lg md:max-w-2xl mx-auto px-5 md:px-8 pt-12 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="md:hidden p-2 rounded-full bg-muted-light hover:bg-foreground/10 transition-colors">
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

      {/* Calendars */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Calendars</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <div className="text-xs text-muted mb-3 space-y-1.5">
            <p>Add calendar feeds so GaeDHD can see your day and slot tasks into the gaps.</p>
            <p className="font-semibold text-foreground">It must be the iCal feed, not a share link:</p>
            <p>
              <span className="font-semibold">Google:</span> open the calendar&apos;s Settings → scroll to
              &ldquo;Integrate calendar&rdquo; → copy <span className="font-semibold">&ldquo;Secret address in iCal format&rdquo;</span>{' '}
              (ends in <code className="bg-muted-light px-1 rounded">.ics</code>). The normal share/public link won&apos;t work.
            </p>
            <p>
              <span className="font-semibold">Apple/iCloud:</span> share the calendar → Public Calendar → copy the
              <span className="font-semibold"> webcal://</span> link.
            </p>
          </div>

          {/* Existing calendars */}
          {store.settings.calendarSources.length > 0 && (
            <div className="space-y-2 mb-3">
              {store.settings.calendarSources.map((cal) => (
                <div key={cal.id} className="flex items-center gap-2.5 bg-muted-light rounded-xl px-3 py-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cal.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{cal.name}</p>
                    <p className="text-[10px] text-muted truncate">{cal.url}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted shrink-0">
                    {cal.type === 'google' ? 'Google' : 'iCal'}
                  </span>
                  <button
                    onClick={() => store.removeCalendarSource(cal.id)}
                    className="p-1 text-muted hover:text-red-500 transition-colors shrink-0"
                    aria-label="Remove calendar"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new calendar */}
          <div className="space-y-2">
            <input
              type="text"
              value={calName}
              onChange={(e) => setCalName(e.target.value)}
              placeholder="Calendar name (e.g. Work, Family)"
              className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted"
            />
            <input
              type="url"
              value={calUrl}
              onChange={(e) => setCalUrl(e.target.value)}
              placeholder="Paste iCal / Google Calendar link"
              className="w-full bg-muted-light rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted"
            />
            {calUrl.trim() && (
              <p className="text-[10px] text-muted px-1">
                Detected: <span className="font-bold">{detectCalendarType(calUrl) === 'google' ? 'Google Calendar' : 'iCal feed'}</span>
              </p>
            )}
            <button
              onClick={handleAddCalendar}
              disabled={!calUrl.trim()}
              className="w-full py-2.5 bg-accent text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Add calendar
            </button>
          </div>
        </div>
      </section>

      {/* Daily anchors */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Daily anchors</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-3">
            Fixed points in her day, like the school runs. Everything movable schedules around
            these. Set the time and the days each repeats.
          </p>
          <div className="space-y-3">
            {store.settings.fixedBlocks.filter(b => !b.date).map(b => (
              <div key={b.id} className="bg-muted-light rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={b.title}
                    onChange={e => store.updateFixedBlock(b.id, { title: e.target.value })}
                    className="flex-1 min-w-0 bg-card rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <input
                    type="time"
                    value={`${String(b.startHour).padStart(2, '0')}:${String(b.startMin).padStart(2, '0')}`}
                    onChange={e => { const [h, m] = e.target.value.split(':').map(Number); store.updateFixedBlock(b.id, { startHour: h || 0, startMin: m || 0 }) }}
                    className="bg-card rounded-lg px-2 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button onClick={() => store.removeFixedBlock(b.id)} className="p-1.5 text-muted hover:text-red-500 transition-colors shrink-0" aria-label="Remove anchor">
                    <X size={15} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                    <button
                      key={idx}
                      onClick={() => store.updateFixedBlock(b.id, { days: b.days.includes(idx) ? b.days.filter(x => x !== idx) : [...b.days, idx].sort((a, z) => a - z) })}
                      className={`w-7 h-7 rounded-full text-[11px] font-bold transition-colors ${b.days.includes(idx) ? 'bg-foreground text-background' : 'bg-card text-muted hover:bg-foreground/10'}`}
                    >
                      {d}
                    </button>
                  ))}
                  <span className="ml-auto font-mono text-[10px] text-muted">{b.durationMin}m</span>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => store.addFixedBlock({ id: `anchor-${Date.now()}`, title: 'New anchor', emoji: '', startHour: 9, startMin: 0, durationMin: 30, travelMin: 0, days: [1, 2, 3, 4, 5], color: '#9B7EC8' })}
            className="w-full mt-3 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add anchor
          </button>
        </div>
      </section>

      {/* Important dates */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Calendar size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Important dates</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-3">
            Birthdays and anniversaries. She gets a heads-up as they near, and the ones marked
            for prep drop a gift task into her list a few days early. Add the family here.
          </p>
          <div className="space-y-2">
            {store.settings.importantDates.map(d => (
              <div key={d.id} className="bg-muted-light rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    value={d.label}
                    onChange={e => store.updateImportantDate(d.id, { label: e.target.value })}
                    className="flex-1 min-w-0 bg-card rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <input
                    type="date"
                    value={`${String(d.year ?? 2000).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`}
                    onChange={e => { const [y, m, da] = e.target.value.split('-').map(Number); store.updateImportantDate(d.id, { year: y, month: m, day: da }) }}
                    className="bg-card rounded-lg px-2 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <button onClick={() => store.removeImportantDate(d.id)} className="p-1.5 text-muted hover:text-red-500 transition-colors shrink-0" aria-label="Remove date">
                    <X size={15} />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!d.leadDays}
                    onChange={e => store.updateImportantDate(d.id, { leadDays: e.target.checked ? 5 : 0 })}
                    className="accent-accent"
                  />
                  Queue a gift task 5 days before
                </label>
              </div>
            ))}
          </div>
          <button
            onClick={() => store.addImportantDate({ id: `date-${Date.now()}`, label: 'New person', month: 1, day: 1, kind: 'birthday', leadDays: 5 })}
            className="w-full mt-3 py-2.5 bg-accent text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Add date
          </button>
        </div>
      </section>

      {/* Your Setup */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-accent" />
          <h2 className="font-bold text-sm">Your setup</h2>
        </div>
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <p className="text-xs text-muted mb-3">
            Tell GaeDHD about your space, equipment, and how you like to work. The AI uses this to
            write steps that fit you, naming your actual gear and spots instead of generic advice.
          </p>
          <textarea
            value={store.settings.userContext}
            onChange={(e) => store.updateSettings({ userContext: e.target.value })}
            placeholder="e.g. I have a kettlebell and a resistance band in my room. There's a couch in the office I can use for split squats. I like short workouts in the morning. Long instructions overwhelm me, so keep steps tiny."
            className="w-full bg-muted-light rounded-xl px-4 py-3 text-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-accent/30 placeholder:text-muted leading-relaxed"
          />
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
          <div className="text-xs text-muted mb-3 space-y-1 font-mono">
            <p>{store.goals.length} goals</p>
            <p>{store.microTasks.filter(t => t.status === 'completed').length}/{store.microTasks.length} micro-tasks</p>
            <p>{store.chatMessages.length} chat messages</p>
            <p>{store.parkingLot.length} parking lot items</p>
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
        GaeDHD v0.1.0 · Made for ADHD brains
      </p>
    </div>
  )
}
