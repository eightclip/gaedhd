'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Zap, MessageCircle, Target, ParkingMeter, TrendingUp, Send, Settings, type LucideIcon } from 'lucide-react'

// Her Telegram bot. External — opens Telegram to @gaedhd_bot.
const BOT_URL = 'https://t.me/gaedhd_bot'

type Item = { href: string; label: string; icon: LucideIcon; tint: string; ink: string; external?: boolean; full?: boolean }

// One destination per tile, each in a soft palette tint from DESIGN.md so the
// menu feels like the rest of the app (bento tiles, color where she glances).
const ITEMS: Item[] = [
  { href: '/', label: 'Today', icon: Zap, tint: '#F5E6E0', ink: '#C85D3E' },             // terracotta
  { href: '/chat', label: 'Chat', icon: MessageCircle, tint: '#E2EEF2', ink: '#6BA3BE' }, // sky
  { href: '/goals', label: 'Goals', icon: Target, tint: '#E8F0E4', ink: '#7B9E6B' },      // sage
  { href: '/parking-lot', label: 'Dump', icon: ParkingMeter, tint: '#F5ECD9', ink: '#A89060' }, // gold
  { href: '/progress', label: 'Progress', icon: TrendingUp, tint: '#F5E4EC', ink: '#C87E9E' },   // rose
  { href: BOT_URL, label: 'Bot', icon: Send, tint: '#ECE5F3', ink: '#9B7EC8', external: true },  // lavender
  { href: '/settings', label: 'Settings', icon: Settings, tint: '#EFEAE2', ink: '#9B9590', full: true }, // warm grey, full width
]

const ITEM_VAR = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }

// Mobile-only nav. A hamburger (top-right) opens a bento grid of color-tinted
// destination tiles that drops in over a blurred backdrop. Replaces the old
// bottom tab bar. Desktop keeps the SideNav.
export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Lock body scroll + close on Escape while the menu is open.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open])

  // Close on navigation.
  useEffect(() => { setOpen(false) }, [pathname])

  if (pathname === '/login' || pathname.startsWith('/kiosk')) return null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <>
      {/* Trigger — top-right so it never collides with sub-page back buttons (top-left). */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden fixed right-4 z-50 w-11 h-11 rounded-full bg-card/85 backdrop-blur border border-card-border text-foreground shadow-sm flex items-center justify-center active:scale-95 transition-transform"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <Menu size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div className="md:hidden fixed inset-0 z-[60]" initial="hidden" animate="show" exit="hidden">
            {/* Dimmed, blurred backdrop. */}
            <motion.button
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
              transition={{ duration: 0.2 }}
            />

            {/* Panel drops from the top. */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-x-0 top-0 bg-background rounded-b-[2rem] border-b border-card-border shadow-2xl px-5 pb-6"
              style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
              variants={{ hidden: { y: '-100%' }, show: { y: 0 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="flex items-center justify-between mb-5">
                <span className="font-display text-3xl font-bold tracking-tight">
                  Where to<span className="italic" style={{ color: 'var(--today-ink)' }}>?</span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="w-9 h-9 rounded-full bg-muted-light flex items-center justify-center text-foreground active:scale-95 transition-transform"
                >
                  <X size={18} />
                </button>
              </div>

              <motion.div
                className="grid grid-cols-2 gap-3"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } } }}
              >
                {ITEMS.map((it) => {
                  const Icon = it.icon
                  const active = !it.external && isActive(it.href)
                  const tileClass = `relative flex ${it.full ? 'flex-row items-center gap-3 min-h-16' : 'flex-col gap-2.5 min-h-24 items-start'} justify-center rounded-3xl p-4 active:scale-[0.97] transition-transform`
                  const inner = (
                    <>
                      <Icon size={24} strokeWidth={2.25} />
                      <span className="font-bold text-base">{it.label}</span>
                      {active && (
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: it.ink }} />
                      )}
                    </>
                  )
                  return (
                    <motion.div key={it.label} variants={ITEM_VAR} className={it.full ? 'col-span-2' : ''}>
                      {it.external ? (
                        <a
                          href={it.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setOpen(false)}
                          className={tileClass}
                          style={{ backgroundColor: it.tint, color: it.ink }}
                        >
                          {inner}
                        </a>
                      ) : (
                        <Link
                          href={it.href}
                          onClick={() => setOpen(false)}
                          className={tileClass}
                          style={{ backgroundColor: it.tint, color: it.ink, outline: active ? `2px solid ${it.ink}` : 'none', outlineOffset: '2px' }}
                        >
                          {inner}
                        </Link>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
