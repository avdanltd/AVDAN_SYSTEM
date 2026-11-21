import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Button, Skeleton, fonts, formatDateTime, radius, spacing, toast, useTheme } from '@avdan/mobile'

import { useMessages, useSendMessage } from '../hooks/use-vendor'

/** Messages between this store and the AVDAN team, e.g. about fixing a store application. */
export function Messages() {
  const { colors } = useTheme()
  const { data, isLoading } = useMessages()
  const { mutate: send, isPending } = useSendMessage()
  const [draft, setDraft] = useState('')
  const scroller = useRef<ScrollView>(null)
  const messages = data ?? []

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true })
  }, [messages.length])

  const submit = () => {
    const text = draft.trim()
    if (!text || isPending) return
    send(text, {
      onSuccess: () => setDraft(''),
      onError: () => toast.error('Could not send', 'Check your connection and try again.'),
    })
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView ref={scroller} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {isLoading ? (
          <Skeleton height={56} />
        ) : messages.length === 0 ? (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>
            No messages yet. If the AVDAN team needs anything from you, it will show up here.
          </Text>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === 'vendor'
            return (
              <View key={m.id} style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                  ]}
                >
                  <Text style={[styles.body, { color: mine ? colors.primaryForeground : colors.foreground }]}>
                    {m.body}
                  </Text>
                  <Text style={[styles.meta, { color: mine ? colors.primaryForeground : colors.mutedForeground }]}>
                    {mine ? 'You' : 'AVDAN'} · {formatDateTime(m.created_at)}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write to AVDAN…"
          placeholderTextColor={colors.subtleForeground}
          multiline
          maxLength={2000}
        />
        <Button label="Send" onPress={submit} loading={isPending} disabled={!draft.trim()} fullWidth={false} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  empty: { fontFamily: fonts.sans, fontSize: 14, textAlign: 'center', marginTop: spacing.xxxl },
  row: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 4 },
  body: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 20 },
  meta: { fontFamily: fonts.sans, fontSize: 10.5, opacity: 0.75 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontFamily: fonts.sans, fontSize: 15 },
})
