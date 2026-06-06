'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, MessageCircle, Target, ParkingMeter, TrendingUp, Settings, Send } from 'lucide-react'
import { Illo } from './Illo'

// Her Telegram bot. External link — opens Telegram (app or web) to @gaedhd_bot.
const BOT_URL = 'https://t.me/gaedhd_bot'

const tabs = [
  { href: '/', label: 'Today', icon: Zap },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/parking-lot', label: 'Dump', icon: ParkingMeter },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
]

export function SideNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname.startsWith('/kiosk')) return null

  return (
    <nav className="hidden md:flex flex-col w-56 min-h-screen bg-[#1A1714] shrink-0 px-3 py-6 sticky top-0 self-start">
      <div className="flex items-center gap-2.5 px-3 mb-8">
        <Illo src="/avatar.png" alt="" className="w-9 h-9 rounded-xl" />
        <span className="font-display text-xl font-bold text-white">GaeDHD</span>
      </div>

      <div className="flex flex-col gap-1 flex-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-[#8A8580] hover:text-[#C8C0B8] hover:bg-white/5'
              }`}
            >
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-sm font-semibold">{tab.label}</span>
            </Link>
          )
        })}

        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-[#8A8580] hover:text-[#C8C0B8] hover:bg-white/5"
        >
          <Send size={18} />
          <span className="text-sm font-semibold">Bot</span>
        </a>
      </div>

      <Link
        href="/settings"
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors mt-2 ${
          pathname === '/settings'
            ? 'bg-white/10 text-white'
            : 'text-[#8A8580] hover:text-[#C8C0B8] hover:bg-white/5'
        }`}
      >
        <Settings size={18} />
        <span className="text-sm font-semibold">Settings</span>
      </Link>
    </nav>
  )
}
