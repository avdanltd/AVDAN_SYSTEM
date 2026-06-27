import { z } from 'zod'

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional().or(z.literal('')),
  icon: z.string().max(50).optional().or(z.literal('')),
  sort_order: z.coerce.number().int().min(0).default(0),
})

export const categoryUpdateSchema = categoryCreateSchema.extend({
  active: z.boolean().optional(),
})

export type CategoryCreateForm = z.infer<typeof categoryCreateSchema>
export type CategoryUpdateForm = z.infer<typeof categoryUpdateSchema>
