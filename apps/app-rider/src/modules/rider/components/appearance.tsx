import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Check, Monitor, Moon, Sun } from 'lucide-react-native'
import { AvdanMark, Badge, Card, fonts, radius, spacing, useTheme } from '@avdan/mobile'
import type { ThemePreference } from '@avdan/mobile'

const OPTIONS: { key: ThemePreference; label: string; description: string; Icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', description: 'Always use the light theme.', Icon: Sun },
  { key: 'dark', label: 'Dark', description: 'Always use the dark theme.', Icon: Moon },
  {
    key: 'system',
    label: 'System',
    description: 'Follow your phone’s display setting.',
    Icon: Monitor,
  },
]

export function Appearance() {
  const { colors, preference, setPreference, scheme } = useTheme()

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Live preview */}
      <Card style={styles.preview}>
        <View style={styles.previewHead}>
          <AvdanMark size={34} badge />
          <View style={styles.previewText}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>AVDAN Rider</Text>
            <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
              Currently showing the {scheme} theme
            </Text>
          </View>
        </View>
        <View style={styles.swatches}>
          {[colors.primary, colors.accent, colors.success, colors.destructive].map((c) => (
            <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
          ))}
        </View>
      </Card>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>THEME</Text>

      <Card style={styles.group}>
        {OPTIONS.map((opt, i) => {
          const selected = preference === opt.key
          const { Icon } = opt
          return (
            <View key={opt.key}>
              {i > 0 ? <View style={[styles.sep, { backgroundColor: colors.border }]} /> : null}
              <Pressable
                onPress={() => setPreference(opt.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
              >
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: selected ? colors.primaryMuted : colors.muted },
                  ]}
                >
                  <Icon size={17} color={selected ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={styles.rowText}>
                  <View style={styles.rowTitleLine}>
                    <Text style={[styles.rowTitle, { color: colors.foreground }]}>{opt.label}</Text>
                    {opt.key === 'system' && preference === 'system' ? (
                      <Badge label={scheme} bg={colors.muted} fg={colors.mutedForeground} />
                    ) : null}
                  </View>
                  <Text style={[styles.rowDesc, { color: colors.mutedForeground }]}>
                    {opt.description}
                  </Text>
                </View>
                {selected ? <Check size={19} color={colors.primary} /> : null}
              </Pressable>
            </View>
          )
        })}
      </Card>

      <Text style={[styles.hint, { color: colors.subtleForeground }]}>
        Your choice is saved on this device only.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  preview: { gap: spacing.lg },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  previewText: { flex: 1, gap: 2 },
  previewTitle: { fontFamily: fonts.display, fontSize: 18 },
  previewSub: { fontFamily: fonts.sans, fontSize: 13 },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { flex: 1, height: 8, borderRadius: radius.full },
  sectionLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    marginTop: spacing.sm,
    marginLeft: spacing.xs,
  },
  group: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  icon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  rowDesc: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 17 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, textAlign: 'center', marginTop: spacing.xs },
})
