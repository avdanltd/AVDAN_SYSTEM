'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import {
  Avatar,
  AvatarFallback,
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
  UserStatusBadge,
  toast,
} from '@avdan/ui'
import { Loader2, User } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useAuthStore } from '@/modules/auth/store/auth.store'
import type { User as UserType } from '@/modules/auth/services/auth.service'

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Enter a valid phone number').optional().or(z.literal('')),
})

type ProfileInput = z.infer<typeof profileSchema>

function getInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function ProfilePage() {
  const { user } = useSession()
  const setUser = useAuthStore((s) => s.setUser)

  const form = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
    },
  })

  // Sync form when user loads
  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? '',
        phone: user.phone ?? '',
      })
    }
  }, [user, form])

  const { mutate: updateProfile, isPending } = useMutation({
    mutationFn: (data: ProfileInput) =>
      apiClient.patch<UserType>('/auth/me', data),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Profile updated successfully')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    },
  })

  function onSubmit(data: ProfileInput) {
    updateProfile(data)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-muted-foreground">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* User card */}
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-2xl">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="font-semibold text-foreground">{user?.name ?? '—'}</p>
              <p className="text-sm text-muted-foreground">{user?.email ?? user?.phone ?? ''}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs capitalize text-muted-foreground">{user?.role}</span>
              {user?.status && <UserStatusBadge status={user.status} />}
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Edit Profile
            </CardTitle>
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
                        <Input placeholder="Your full name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Email</label>
                  <Input
                    value={user?.email ?? ''}
                    disabled
                    className="bg-muted text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>

                <FormField
                  control={form.control}
                  name="phone"
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

                <Separator />

                <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
