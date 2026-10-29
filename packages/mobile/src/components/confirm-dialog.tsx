import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { Button } from './ui'

/**
 * Custom confirmation dialog — the RN equivalent of `@avdan/ui`'s `ConfirmDialog`.
 *
 * Design-system hard rule: no native `Alert.alert` anywhere in any mobile app. Every
 * confirmation ("Sign out?", "Discard changes?", "Delete account?") renders this instead, so it
 * always matches the app's theme (light/dark) and never looks like an OS dialog.
 */
export function ConfirmDialog({
  visible,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
}: {
  visible: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
}) {
  const { colors, shadowModal } = useTheme()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadowModal]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="outline" onPress={onClose} disabled={loading} fullWidth={false} />
            <Button
              label={loading ? 'Please wait…' : confirmLabel}
              variant={destructive ? 'destructive' : 'default'}
              onPress={onConfirm}
              loading={loading}
              fullWidth={false}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { fontFamily: fonts.display, fontSize: 19 },
  description: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
})
