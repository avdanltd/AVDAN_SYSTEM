import type { Category } from '../types'

export interface CategoryNode {
  category: Category
  children: Category[]
}

/** Top-level categories, each with its sub-categories (one level, as the API enforces). */
export function nestCategories(categories: Category[] | undefined): CategoryNode[] {
  const all = categories ?? []
  const ids = new Set(all.map((c) => c.id))
  // A sub-category whose parent isn't in the list (e.g. deactivated) is shown as a top-level one.
  const tops = all.filter((c) => !c.parent_id || !ids.has(c.parent_id))
  return tops.map((category) => ({
    category,
    children: all.filter((c) => c.parent_id === category.id),
  }))
}

/** Flat list for a <select>: each category followed by its sub-categories, labelled "Fashion › Shoes". */
export function categoryOptions(categories: Category[]): { cat: Category; label: string }[] {
  return nestCategories(categories).flatMap(({ category, children }) => [
    { cat: category, label: category.name },
    ...children.map((cat) => ({ cat, label: `${category.name} › ${cat.name}` })),
  ])
}
