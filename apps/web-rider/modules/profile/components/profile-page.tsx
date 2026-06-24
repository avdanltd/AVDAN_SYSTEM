'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@avdan/ui'
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
} from '@avdan/ui'

import { useSession } from '@/modules/auth/hooks/use-session'
import { useLogout } from '@/modules/auth/hooks/use-logout'
import { authService } from '@/modules/auth/services/auth.service'
import { useAuthStore } from '@/modules/auth/store/auth.store'

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user } = useSession()
  const setUser = useAuthStore((s) => s.setUser)
  const { mutate: logout, isPending: isLoggingOut } = useLogout()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
  })

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (v: ProfileFormValues) => authService.updateMe(v),
    onSuccess: (updated) => {
      setUser(updated)
      toast.success('Profile updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold">Profile</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{user?.role ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize">{user?.status ?? '—'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => update(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
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
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+234..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isUpdating}>
                {isUpdating ? 'Saving…' : 'Save Changes'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Separator />

      <Button
        variant="destructive"
        className="w-full"
        onClick={() => logout()}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? 'Signing out…' : 'Sign Out'}
      </Button>
    </div>
  )
}
