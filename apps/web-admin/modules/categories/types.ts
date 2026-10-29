export interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort_order: number
  active: boolean
}

export interface CategoryCreate {
  name: string
  slug?: string
  description?: string | null
  icon?: string | null
  sort_order?: number
}

export interface CategoryUpdate {
  name?: string
  description?: string | null
  icon?: string | null
  sort_order?: number
  active?: boolean
}
