import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  ChevronRight,
  CircleUser,
  LogOut,
  Mail,
  Moon,
  Phone,
  ShieldCheck,
  Store,
  Wallet,
} from 'lucide-react-native'

import { statusLabel } from '@/constants/status'
import { useVendorAnalytics, useVendorProfile } from '../hooks/use-vendor'
import { AvdanMark, Badge, Button, Card, fonts, formatKobo, initials, radius, spacing, useLogout, useSession, useTheme } from '@avdan/mobile'

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
  const { data: vendor } = useVendorProfile()
  const { data: analytics } = useVendorAnalytics()
  const router = useRouter()

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You will stop receiving new order alerts until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
    ])
  }

  const themeLabel = preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.identity}>
        <View
          style={[styles.avatar, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}
        >
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {initials(vendor?.name ?? user?.name, 'V')}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {vendor?.name ?? 'Your store'}
        </Text>
        <View style={styles.badgeRow}>
          {vendor?.status ? (
            <Badge
              label={statusLabel(vendor.status)}
              bg={vendor.status === 'active' ? colors.successMuted : colors.warningMuted}
              fg={vendor.status === 'active' ? colors.success : colors.warning}
            />
          ) : null}
          {vendor?.rating ? (
            <Badge
              label={`${vendor.rating.toFixed(1)} ★`}
              bg={colors.muted}
              fg={colors.mutedForeground}
            />
          ) : null}
        </View>
      </Card>

      {/* Payout summary */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>EARNINGS</Text>
        <Card style={styles.earnings}>
          <View style={styles.earningsRow}>
            <View style={styles.earningsCell}>
              <Text style={[styles.earningsValue, { color: colors.foreground }]} numberOfLines={1}>
                {analytics ? formatKobo(analytics.total_revenue_kobo) : '—'}
              </Text>
              <Text style={[styles.earningsLabel, { color: colors.mutedForeground }]}>
                Total revenue
              </Text>
            </View>
            <View style={[styles.earningsDivider, { backgroundColor: colors.border }]} />
            <View style={styles.earningsCell}>
              <Text style={[styles.earningsValue, { color: colors.accent }]} numberOfLines={1}>
                {analytics ? formatKobo(analytics.pending_release_kobo) : '—'}
              </Text>
              <Text style={[styles.earningsLabel, { color: colors.mutedForeground }]}>
                Awaiting payout
              </Text>
            </View>
          </View>
          {analytics ? (
            <Text style={[styles.commission, { color: colors.subtleForeground }]}>
              {/* The API returns a fraction (0.1), not a percentage — same convention
                  web-vendor's earnings page uses. */}
              AVDAN commission is {(analytics.commission_rate * 100).toFixed(1)}% ·{' '}
              {analytics.completed_orders} orders completed
            </Text>
          ) : null}
        </Card>
      </View>

      {/* Account */}
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

      {/* Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>SETTINGS</Text>
        <Card style={styles.groupTight}>
          <NavRow
            icon={<Store size={17} color={colors.primary} />}
            label="Storefront details"
            onPress={() => router.push('/profile/storefront')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <NavRow
            icon={<CircleUser size={17} color={colors.primary} />}
            label="Edit your profile"
            onPress={() => router.push('/profile/edit')}
          />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <NavRow
            icon={<Wallet size={17} color={colors.primary} />}
            label="Payout account"
            value={vendor?.has_payout_account ? 'Active' : 'Not set'}
            onPress={() => router.push('/profile/payout')}
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

      {/* Escrow cannot be released without a verified payout account, so an unset one is
          surfaced as a warning rather than buried in the settings list. */}
      {vendor && !vendor.has_payout_account ? (
        <Pressable onPress={() => router.push('/profile/payout')}>
          <Card style={[styles.payoutWarn, { backgroundColor: colors.warningMuted }]}>
            <View style={styles.payoutHead}>
              <Wallet size={17} color={colors.warning} />
              <Text style={[styles.payoutTitle, styles.payoutTitleFlex, { color: colors.foreground }]}>
                Add a payout account
              </Text>
              <ChevronRight size={17} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.payoutBody, { color: colors.mutedForeground }]}>
              Your earnings stay in escrow until a verified bank account is on file.
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <Button
        label={isPending ? 'Signing out…' : 'Sign out'}
        variant="destructive"
        icon={<LogOut size={16} color={colors.destructiveForeground} />}
        onPress={confirmLogout}
        loading={isPending}
      />

      <View style={styles.footer}>
        <AvdanMark size={26} />
        <Text style={[styles.footerText, { color: colors.subtleForeground }]}>
          AVDAN Vendor · v1.0.0
        </Text>
        <View style={styles.footerNote}>
          <ShieldCheck size={12} color={colors.subtleForeground} />
          <Text style={[styles.footerNoteText, { color: colors.subtleForeground }]}>
            Payments are held in escrow until delivery is confirmed.
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxxl },
  identity: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 26 },
  name: { fontFamily: fonts.display, fontSize: 22 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  section: { gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    marginLeft: spacing.xs,
  },
  earnings: { gap: spacing.md },
  earningsRow: { flexDirection: 'row', alignItems: 'center' },
  earningsCell: { flex: 1, gap: 2, alignItems: 'center' },
  earningsDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  earningsValue: { fontFamily: fonts.display, fontSize: 19 },
  earningsLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  commission: { fontFamily: fonts.sans, fontSize: 12, textAlign: 'center' },
  group: { gap: 0, paddingVertical: spacing.xs },
  groupTight: { padding: 0, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infoValue: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14.5 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.xl },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 56,
  },
  navIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15 },
  navValue: { fontFamily: fonts.sans, fontSize: 13.5, maxWidth: 120 },
  payoutWarn: { gap: spacing.sm },
  payoutHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  payoutTitleFlex: { flex: 1 },
  payoutTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  payoutBody: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  footer: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  footerText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.xl },
  footerNoteText: { fontFamily: fonts.sans, fontSize: 11.5, textAlign: 'center' },
})
