'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Phone, Mail, Shield } from 'lucide-react'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Avatar,
  AvatarFallback,
  Separator,
  Badge,
} from '@avdan/ui'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useUpdateProfile } from '../hooks/use-update-profile'

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  phone: z
    .string()
    .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number')
    .or(z.literal('')),
})

type ProfileFormValues = z.infer<typeof profileSchema>

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'H'
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

export function ProfilePage() {
  const { user } = useSession()
  const { mutate: updateProfile, isPending } = useUpdateProfile()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    },
  })

  // Keep form in sync if user loads after mount
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user, form])

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile({
      name: values.name || undefined,
      phone: values.phone || undefined,
    })
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your agent account details.
        </p>
      </div>

      {/* Identity card */}
      <Card className="shadow-card">
        <CardContent className="flex items-center gap-5 pt-6">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="text-xl font-semibold">
              {getUserInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{user?.name ?? '—'}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {user?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
              )}
            </div>
            <div className="mt-2">
              <Badge variant="secondary" className="capitalize text-xs">
                <Shield className="mr-1 h-3 w-3" />
                {user?.role ?? 'hub_agent'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">Edit Details</CardTitle>
          <CardDescription>Update your name and phone number.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} placeholder="Your full name" className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input {...field} placeholder="+234 800 000 0000" className="pl-9" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isPending} className="min-w-[120px]">
                  {isPending ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset()}
                  disabled={isPending || !form.formState.isDirty}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Read-only info */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-base">Account Info</CardTitle>
          <CardDescription>These fields are managed by your administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium text-foreground">{user?.email ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Role</dt>
              <dd className="text-sm font-medium text-foreground capitalize">{user?.role ?? '—'}</dd>
            </div>
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm text-muted-foreground">Account Status</dt>
              <dd className="text-sm font-medium text-foreground capitalize">{user?.status ?? '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
