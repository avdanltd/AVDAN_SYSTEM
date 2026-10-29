'use client'

import {
  Activity,
  Baby,
  Book,
  Cpu,
  Heart,
  Home,
  ShoppingBag,
  Shirt,
  Tag,
  type LucideProps,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  activity: Activity,
  baby: Baby,
  book: Book,
  cpu: Cpu,
  heart: Heart,
  home: Home,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
}

interface CategoryIconProps extends Omit<LucideProps, 'name'> {
  name: string | null | undefined
}

export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  const Icon = name ? (ICON_MAP[name.toLowerCase()] ?? Tag) : Tag
  return <Icon {...props} />
}
