import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  ChevronRight,
  CircleUser,
  LogOut,
  Mail,
  Moon,
  Package,
  Phone,
  ShieldCheck,
} from 'lucide-react-native'
import { AvdanMark, Button, Card, fonts, initials, radius, spacing, useSession, useLogout, useTheme } from '@avdan/mobile'

function NavRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.65 }]}
    >
      <View style={[styles.navIcon, { backgroundColor: colors.muted }]}>{icon}</View>
      <Text style={[styles.navLabel, { color: colors.foreground }]}>{label}</Text>
      {value ? (
        <Text style={[styles.navValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronRight size={17} color={colors.subtleForeground} />
    </Pressable>
  )
}

export function Profile() {
  const { user } = useSession()
  const { mutate: logout, isPending } = useLogout()
  const { colors, preference } = useTheme()
  const router = useRouter()

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ])
  }

  const themeLabel = preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initials(user?.name)}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? 'Your account'}</Text>
      </Card>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
        <Card style={styles.group}>
          <View style={styles.infoRow}>
            <Mail size={16} color={colors.subtleForeground} />
            <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <View style={styles.infoRow}>
            <Phone size={16} color={colors.subtleForeground} />
            <Text style={[styles.infoValue, { color: colors.foreground }]} numberOfLines={1}>
              {user?.phone ?? 'Not set'}
            </Text>
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SETTINGS</Text>
        <Card style={styles.groupTight}>
          <NavRow
            icon={<Package size={17} color={colors.primary} />}
            label="My orders"
            onPress={() => router.push('/orders')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <NavRow
            icon={<CircleUser size={17} color={colors.primary} />}
            label="Edit profile"
            onPress={() => router.push('/profile/edit')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <NavRow
            icon={<Moon size={17} color={colors.primary} />}
            label="Appearance"
            value={themeLabel}
            onPress={() => router.push('/profile/appearance')}
          />
        </Card>
      </View>

      <Button
        label={isPending ? 'Signing out…' : 'Sign out'}
        variant="destructive"
        icon={<LogOut size={16} color={colors.destructiveForeground} />}
        onPress={confirmLogout}
        loading={isPending}
      />

      <View style={styles.footer}>
        <AvdanMark size={26} />
        <Text style={[styles.footerText, { color: colors.subtleForeground }]}>AVDAN · v1.0.0</Text>
        <View style={styles.footerNote}>
          <ShieldCheck size={12} color={colors.subtleForeground} />
          <Text style={[styles.footerNoteText, { color: colors.subtleForeground }]}>
            Your payments are held safely until delivery is confirmed.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  identity: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  avatar: { width: 76, height: 76, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 26 },
  name: { fontFamily: fonts.display, fontSize: 22 },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.4, marginLeft: spacing.xs },
  group: { gap: 0, paddingVertical: spacing.xs },
  groupTight: { padding: 0, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  infoValue: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14.5 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.xl },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg, minHeight: 56 },
  navIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  navLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15 },
  navValue: { fontFamily: fonts.sans, fontSize: 13.5, maxWidth: 120 },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  footerText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.xl },
  footerNoteText: { fontFamily: fonts.sans, fontSize: 11.5, textAlign: 'center' },
})
