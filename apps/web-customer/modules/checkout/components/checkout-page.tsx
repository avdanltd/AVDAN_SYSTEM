'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Separator,
  Textarea,
  toast,
} from '@avdan/ui'
import { Loader2, ShoppingCart } from 'lucide-react'
import { checkoutSchema, type CheckoutInput } from '../schemas/checkout.schemas'
import { useCreateOrder, useInitiatePayment } from '../hooks/use-checkout'
import { useCartStore } from '@/modules/cart/store/cart.store'
import { useSession } from '@/modules/auth/hooks/use-session'
import { ROUTES } from '@/config/routes'

function formatPrice(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', { style: 'currency', currency: 'NGN' })
}

export function CheckoutPage() {
  const router = useRouter()
  const { items, vendorId, vendorName, totalKobo, clearCart } = useCartStore()
  const { user } = useSession()

  const { mutateAsync: createOrder, isPending: isCreating } = useCreateOrder()
  const { mutateAsync: initiatePayment, isPending: isInitiating } = useInitiatePayment()

  const isLoading = isCreating || isInitiating

  const form = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      delivery_address: { street: '', city: '', state: '', notes: '' },
      contact_phone: user?.phone ?? '',
    },
  })

  // Prefill phone once session loads
  useEffect(() => {
    if (user?.phone && !form.getValues('contact_phone')) {
      form.setValue('contact_phone', user.phone)
    }
  }, [user?.phone, form])

  // If cart is empty, redirect home
  useEffect(() => {
    if (items.length === 0) {
      router.replace(ROUTES.home)
    }
  }, [items.length, router])

  if (items.length === 0 || !vendorId) {
    return null
  }

  async function onSubmit(data: CheckoutInput) {
    try {
      const order = await createOrder({
        vendor_id: vendorId!,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        delivery_address: data.delivery_address,
        contact_phone: data.contact_phone,
      })

      const payment = await initiatePayment(order.id)
      clearCart()
      // Redirect to Paystack payment page
      window.location.href = payment.payment_url
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to place order. Please try again.'
      toast.error(message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Checkout</h1>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-0">
          {['Cart', 'Delivery', 'Payment'].map((step, i) => (
            <div key={step} className="flex items-center">
              <div className={`flex items-center gap-1.5 ${i === 1 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 1 ? 'bg-primary text-white' : i < 1 ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="text-sm">{step}</span>
              </div>
              {i < 2 && <span className="mx-3 h-px w-8 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Delivery form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 08012345678" type="tel" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_address.street"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Street Address</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 12 Adeola Hopewell Street" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delivery_address.city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Lagos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="delivery_address.state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Lagos" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="delivery_address.notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Notes (optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Landmark, gate code, floor number…"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCreating ? 'Placing order…' : 'Redirecting to payment…'}
                    </>
                  ) : (
                    `Pay ${formatPrice(totalKobo())}`
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Order summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingCart className="h-4 w-4" />
                Order Summary
              </CardTitle>
              {vendorName && (
                <p className="text-sm text-muted-foreground">from {vendorName}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.product_id} className="flex justify-between gap-2 text-sm">
                  <span className="text-foreground flex-1 line-clamp-1">
                    {item.name}
                    <span className="ml-1 text-muted-foreground">×{item.quantity}</span>
                  </span>
                  <span className="font-medium shrink-0">{formatPrice(item.price_kobo * item.quantity)}</span>
                </div>
              ))}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(totalKobo())}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Delivery fee</span>
                <span>Calculated at dispatch</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total (min)</span>
                <span>{formatPrice(totalKobo())}</span>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-center text-muted-foreground">
            Your payment is processed securely via Paystack. You will be redirected after clicking Pay.
          </p>
        </div>
      </div>
    </div>
  )
}
