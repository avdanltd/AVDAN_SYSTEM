import { z } from 'zod'

export const checkoutSchema = z.object({
  delivery_address: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters'),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    notes: z.string().optional(),
  }),
  contact_phone: z
    .string()
    .min(10, 'Enter a valid phone number (at least 10 digits)')
    .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters'),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
