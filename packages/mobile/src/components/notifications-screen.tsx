import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react-native'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { apiClient } from '../lib/api-client'
import { Button, Card, Skeleton } from './ui'

interface Notification {
  id: string
  type: string
  content: { title?: string; body?: string }
  read_at: string | null
  created_at: string
}

interface NotificationsResponse {
  items: Notification[]
  unread_count: number
}

const KEY = ['notifications']

/** How many notifications the signed-in person has not read yet (for a badge on a menu row). */
export function useUnreadNotifications() {
  return useQuery({
    queryKey: [...KEY, 'unread'],
    queryFn: () => apiClient.get<NotificationsResponse>('/notifications', { page: '1', page_size: '1' }),
    select: (r) => r.unread_count,
    refetchInterval: 60_000,
  })
}

function when(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

/** The in-app notification list shared by every app (the web portals have had one all along). */
export function NotificationsScreen() {
  const { colors } = useTheme()
  const qc = useQueryClient()
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<NotificationsResponse>('/notifications', { page: '1', page_size: '50' }),
    refetchInterval: 30_000,
  })
  const refresh = () => void qc.invalidateQueries({ queryKey: KEY })
  const markRead = useMutation({ mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`, {}), onSettled: refresh })
  const markAll = useMutation({ mutationFn: () => apiClient.post('/notifications/read-all', {}), onSettled: refresh })

  const items = data?.items ?? []
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.primary} />}
    >
      {(data?.unread_count ?? 0) > 0 ? (
        <Button label="Mark all as read" variant="outline" size="sm" fullWidth={false} onPress={() => markAll.mutate()} loading={markAll.isPending} />
      ) : null}
      {isLoading ? (
        <Skeleton height={64} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Bell size={28} color={colors.subtleForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications yet.</Text>
        </View>
      ) : (
        items.map((n) => {
          const unread = n.read_at === null
          return (
            <Pressable key={n.id} onPress={() => unread && markRead.mutate(n.id)} accessibilityRole="button">
              <Card style={[styles.card, unread && { borderColor: colors.primary, borderWidth: 1 }]}>
                <View style={styles.head}>
                  <Text style={[styles.title, { color: colors.foreground, fontFamily: unread ? fonts.sansSemiBold : fonts.sans }]} numberOfLines={2}>
                    {n.content.title ?? 'Notification'}
                  </Text>
                  <Text style={[styles.when, { color: colors.subtleForeground }]}>{when(n.created_at)}</Text>
                </View>
                {n.content.body ? (
                  <Text style={[styles.body, { color: colors.mutedForeground }]} numberOfLines={4}>
                    {n.content.body}
                  </Text>
                ) : null}
              </Card>
            </Pressable>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: 4, borderRadius: radius.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  title: { fontSize: 14.5, flex: 1 },
  when: { fontFamily: fonts.sans, fontSize: 11.5 },
  body: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxxl },
  emptyText: { fontFamily: fonts.sans, fontSize: 14 },
})
