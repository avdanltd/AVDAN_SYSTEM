import { z } from 'zod'
import { NIGERIA_STATES } from '@avdan/types'

export const checkoutSchema = z.object({
  delivery_address: z.object({
    street: z.string().min(5, 'Street number and name must be at least 5 characters'),
    city: z.string().min(2, 'Town / city is required'),
    state: z.string().refine((s) => NIGERIA_STATES.includes(s), 'Select a state'),
    lga: z.string().min(1, 'Select a local government'),
    landmark: z.string().max(200).optional(),
    notes: z.string().optional(),
    // Where to deliver — drives the distance-based delivery fee, so it is required.
    lat: z.number({ message: 'Share your delivery location so we can price delivery by distance' }),
    lng: z.number({ message: 'Share your delivery location so we can price delivery by distance' }),
  }),
  contact_phone: z
    .string()
    .min(10, 'Enter a valid phone number (at least 10 digits)')
    .regex(/^[0-9+\-\s()]+$/, 'Phone number contains invalid characters'),
})

export type CheckoutInput = z.infer<typeof checkoutSchema>
