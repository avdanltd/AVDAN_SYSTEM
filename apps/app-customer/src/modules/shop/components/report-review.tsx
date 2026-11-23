import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { Flag } from 'lucide-react-native'
import { Button, fonts, radius, spacing, toast, useTheme } from '@avdan/mobile'

import { shopService } from '../services/shop.service'

const REASONS = [
  { value: 'offensive', label: 'Offensive or abusive' },
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'false', label: 'Fake or not about this item' },
  { value: 'other', label: 'Something else' },
]

/** "Report" under a review: required by the app stores for user-written content. */
export function ReportReview({ reviewId }: { reviewId: string }) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('offensive')
  const { mutate, isPending } = useMutation({
    mutationFn: () => shopService.reportReview(reviewId, reason),
    onSuccess: (r) => {
      toast.success('Reported', r.message)
      setOpen(false)
    },
    onError: (e: Error) => toast.error('Could not report', e.message),
  })

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} hitSlop={8} style={styles.trigger} accessibilityRole="button" accessibilityLabel="Report this review">
        <Flag size={12} color={colors.subtleForeground} />
        <Text style={[styles.triggerText, { color: colors.subtleForeground }]}>Report</Text>
      </Pressable>
    )
  }
  return (
    <View style={[styles.box, { borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Why are you reporting this review?</Text>
      {REASONS.map((r) => (
        <Pressable
          key={r.value}
          onPress={() => setReason(r.value)}
          style={[styles.option, { borderColor: reason === r.value ? colors.primary : colors.border }]}
        >
          <Text style={[styles.optionText, { color: colors.foreground }]}>{r.label}</Text>
        </Pressable>
      ))}
      <Button label="Send report" size="sm" onPress={() => mutate()} loading={isPending} />
      <Button label="Cancel" size="sm" variant="outline" onPress={() => setOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 2 },
  triggerText: { fontFamily: fonts.sans, fontSize: 12 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginTop: spacing.sm },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  option: { borderWidth: 1, borderRadius: radius.md, padding: spacing.sm },
  optionText: { fontFamily: fonts.sans, fontSize: 13.5 },
})
