import { StyleSheet, Text, View } from 'react-native'
import { CheckCircle2, Info, XCircle } from 'lucide-react-native'
import type { ToastConfig, ToastConfigParams } from 'react-native-toast-message'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'

type Tone = 'success' | 'error' | 'info'

function ToastCard({ tone, text1, text2 }: { tone: Tone } & ToastConfigParams<unknown>) {
  const { colors, shadowModal } = useTheme()

  const accent =
    tone === 'success' ? colors.success : tone === 'error' ? colors.destructive : colors.primary
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : Info

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.cardBorder,
          ...shadowModal,
        },
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: accent }]} />
      <Icon size={20} color={accent} />
      <View style={styles.body}>
        {text1 ? (
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {text1}
          </Text>
        ) : null}
        {text2 ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={3}>
            {text2}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export const toastConfig: ToastConfig = {
  success: (p) => <ToastCard tone="success" {...p} />,
  error: (p) => <ToastCard tone="error" {...p} />,
  info: (p) => <ToastCard tone="info" {...p} />,
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '92%',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 14.5, lineHeight: 20 },
  desc: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
})
