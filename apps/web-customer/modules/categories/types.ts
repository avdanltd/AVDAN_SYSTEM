export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  /** Set on a sub-category: the top-level category it sits under. */
  parent_id: string | null
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}
