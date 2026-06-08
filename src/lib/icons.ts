// Line icons in place of emoji, for an elevated feel. Goal glyphs map by category;
// rituals without a hand-drawn illustration fall back to a line icon.
import {
  Dumbbell, BookOpen, Palette, Home, Briefcase, Users, Heart, ShoppingBag, Target,
  Smartphone, Cookie, Toilet, Coffee, MessageCircle, type LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  fitness: Dumbbell,
  learning: BookOpen,
  art: Palette,
  home: Home,
  work: Briefcase,
  family: Users,
  'self-care': Heart,
  relationships: MessageCircle,
  errands: ShoppingBag,
  custom: Target,
}

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICON[category] || Target
}

// Fallback line icon for rituals with no illustration (e.g. TrakMac content).
export const RITUAL_ICON: Record<string, LucideIcon> = {
  trakmac: Smartphone,
}

// Break buttons.
export const BREAK_ICON: Record<string, LucideIcon> = {
  snack: Cookie,
  bathroom: Toilet,
  break: Coffee,
}
