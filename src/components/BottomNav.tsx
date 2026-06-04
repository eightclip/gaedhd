'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Zap, MessageCircle, Target, ParkingMeter, TrendingUp } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Today', icon: Zap },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/parking-lot', label: 'Dump', icon: ParkingMeter },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
]

export function BottomNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname.startsWith('/kiosk')) return null

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#1A1714] pb-safe">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-[#8A8580] hover:text-[#C8C0B8]'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold tracking-wide">
                {tab.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
