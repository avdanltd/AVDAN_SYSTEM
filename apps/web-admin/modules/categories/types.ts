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
}

export interface CategoryCreate {
  name: string
  slug?: string
  description?: string | null
  icon?: string | null
  parent_id?: string | null
  sort_order?: number
}

export interface CategoryUpdate {
  name?: string
  description?: string | null
  icon?: string | null
  sort_order?: number
  active?: boolean
  /** '' makes it a top-level category again. */
  parent_id?: string | null
}
