import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Building2, Clock } from 'lucide-react-native'
import { Button, Card, ConfirmDialog, Skeleton, fonts, radius, spacing, toast, useTheme } from '@avdan/mobile'

import { useBranchActions, useBusinessSuggestions, useMyBusiness } from '../hooks/use-vendor'

type Pick = { kind: 'business' | 'vendor' | 'brand'; id?: string; name: string }

/**
 * "Is this store a branch of another business?" Each branch stays its own store (own login,
 * products, orders and money); AVDAN links them so customers see one brand. A request is checked
 * by AVDAN before anything changes.
 */
export function Branches() {
  const { colors } = useTheme()
  const { data, isLoading } = useMyBusiness()
  const { request, cancel, leave } = useBranchActions()
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<Pick | null>(null)
  const [note, setNote] = useState('')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const { data: suggestions } = useBusinessSuggestions(q)

  if (isLoading || !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={120} />
      </ScrollView>
    )
  }
  const { business, request: latest } = data
  const pending = latest?.status === 'pending'

  const submit = () => {
    if (!pick) return
    request.mutate(
      {
        ...(pick.kind === 'business' ? { business_id: pick.id } : {}),
        ...(pick.kind === 'vendor' ? { vendor_id: pick.id } : {}),
        ...(pick.kind === 'brand' ? { brand_name: pick.name } : {}),
        note: note.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Sent to AVDAN', 'We will check it and let you know.')
          setPick(null)
          setQ('')
          setNote('')
        },
        onError: (e) => toast.error('Could not send', e instanceof Error ? e.message : 'Try again.'),
      },
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        If your business has other stores on AVDAN, link them so customers see one brand with all its branches. Each branch keeps
        its own login, products, orders and money.
      </Text>

      {business ? (
        <Card style={styles.card}>
          <View style={styles.head}>
            <Building2 size={17} color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>You are a branch of {business.name}</Text>
          </View>
          {business.branches.map((b) => (
            <View key={b.vendor_id} style={styles.row}>
              <Text style={[styles.rowName, { color: colors.foreground, fontFamily: b.is_you ? fonts.sansSemiBold : fonts.sans }]}>
                {b.name}
                {b.is_you ? ' (this store)' : ''}
              </Text>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>{b.place || 'location not set'}</Text>
            </View>
          ))}
          <Button label="Leave this business" variant="outline" onPress={() => setLeaveOpen(true)} />
        </Card>
      ) : pending ? (
        <Card style={styles.card}>
          <View style={styles.head}>
            <Clock size={17} color={colors.warning} />
            <Text style={[styles.title, { color: colors.foreground }]}>Waiting for AVDAN</Text>
          </View>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>
            You asked to be linked as a branch of {latest?.target_name}. We will check it and let you know. You may be asked for
            proof in Messages.
          </Text>
          <Button label="Cancel request" variant="outline" onPress={() => cancel.mutate()} loading={cancel.isPending} />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={[styles.title, { color: colors.foreground }]}>Is this store a branch of another business?</Text>
          {latest?.status === 'rejected' ? (
            <Text style={[styles.muted, { color: colors.destructive }]}>Your last request was not approved: {latest.reason}</Text>
          ) : null}
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
            value={pick ? pick.name : q}
            onChangeText={(t) => {
              setQ(t)
              setPick(null)
            }}
            placeholder="Start typing the business name"
            placeholderTextColor={colors.subtleForeground}
          />
          {!pick && q.trim().length >= 2 ? (
            <View style={styles.list}>
              {(suggestions ?? []).map((s) => (
                <Pressable
                  key={`${s.kind}-${s.id}`}
                  onPress={() => setPick({ kind: s.kind as 'business' | 'vendor', id: s.id, name: s.name })}
                  style={[styles.suggest, { borderColor: colors.border }]}
                >
                  <Text style={[styles.rowName, { color: colors.foreground, fontFamily: fonts.sansSemiBold }]}>{s.name}</Text>
                  <Text style={[styles.muted, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {s.detail}
                  </Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setPick({ kind: 'brand', name: q.trim() })} style={[styles.suggest, { borderColor: colors.border }]}>
                <Text style={[styles.muted, { color: colors.mutedForeground }]}>My business isn&apos;t listed: use “{q.trim()}”</Text>
              </Pressable>
            </View>
          ) : null}
          {pick ? (
            <View style={styles.list}>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>Request to be linked as a branch of {pick.name}</Text>
              <TextInput
                style={[styles.input, styles.note, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
                value={note}
                onChangeText={setNote}
                placeholder="Anything that helps us confirm it (optional)"
                placeholderTextColor={colors.subtleForeground}
                multiline
                maxLength={1000}
              />
              <Button label="Request to join" onPress={submit} loading={request.isPending} />
              <Button label="Change" variant="outline" onPress={() => setPick(null)} />
            </View>
          ) : null}
          <Text style={[styles.muted, { color: colors.subtleForeground }]}>
            Not a branch of anything? You don&apos;t need to do anything: your store shows on its own.
          </Text>
        </Card>
      )}

      <ConfirmDialog
        visible={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title="Leave this business?"
        description="Your store will show to customers on its own again. Your products, orders and money are not affected, and the other branches stay linked."
        confirmLabel="Leave"
        loading={leave.isPending}
        onConfirm={() => leave.mutate(undefined, { onSuccess: () => setLeaveOpen(false) })}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  intro: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 15, flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  rowName: { fontFamily: fonts.sans, fontSize: 14, flexShrink: 1 },
  muted: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 17 },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15, minHeight: 44 },
  note: { minHeight: 80, textAlignVertical: 'top' },
  list: { gap: spacing.sm },
  suggest: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
})
