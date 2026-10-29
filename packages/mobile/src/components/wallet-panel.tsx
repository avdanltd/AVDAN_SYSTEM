import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { PayoutRequest, WalletEntry, WalletSummary } from '@avdan/types'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { formatDateTime, formatKobo } from '../lib/format'
import { Badge, Button, Card, EmptyState, Skeleton } from './ui'

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Awaiting approval',
  PROCESSING: 'Sending to bank',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  FAILED: 'Transfer failed',
}

const ENTRY_LABEL: Record<string, string> = {
  ORDER_CREDIT: 'Earning added',
  WITHDRAWAL_HOLD: 'Withdrawal requested',
  WITHDRAWAL_RELEASE: 'Returned to available',
  WITHDRAWAL_REVERSAL: 'Transfer failed — returned',
}

export interface WalletPanelProps {
  summary?: WalletSummary
  requests: PayoutRequest[]
  entries: WalletEntry[]
  loading: boolean
  error: boolean
  onRetry: () => void
  /** Vendors have a dispute window between delivery and withdrawable; riders do not. */
  showClearing: boolean
  /** Amount in kobo; rejects with an Error whose message is shown in the dialog. */
  onRequestWithdrawal: (amountKobo: number) => Promise<void>
  submitting: boolean
  onSetupAccount?: () => void
}

/**
 * Wallet UI shared by the vendor and rider apps: the five money states, a withdrawal request
 * dialog, and the request + ledger history. Renders a plain column — wrap it in the screen's own
 * ScrollView (so pull-to-refresh stays with the screen).
 */
export function WalletPanel({
  summary,
  requests,
  entries,
  loading,
  error,
  onRetry,
  showClearing,
  onRequestWithdrawal,
  submitting,
  onSetupAccount,
}: WalletPanelProps) {
  const { colors, shadowModal } = useTheme()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  if (error) {
    return (
      <Card>
        <EmptyState
          title="Couldn't load your wallet"
          description="Check your connection and try again."
          action={<Button label="Retry" variant="outline" onPress={onRetry} fullWidth={false} />}
        />
      </Card>
    )
  }

  const available = summary?.available_kobo ?? 0
  const min = summary?.min_withdrawal_kobo ?? 0

  const tiles: { label: string; value: number; note: string; highlight?: boolean }[] = [
    { label: 'Ongoing', value: summary?.ongoing_kobo ?? 0, note: 'Orders in progress' },
    ...(showClearing
      ? [{
          label: 'Delivered',
          value: (summary?.clearing_kobo ?? 0) + (summary?.on_hold_kobo ?? 0),
          note: 'Clearing dispute window',
        }]
      : []),
    { label: 'Available', value: available, note: 'Ready to withdraw', highlight: true },
    { label: 'Requested', value: summary?.requested_kobo ?? 0, note: 'Awaiting approval / bank' },
    { label: 'Paid out', value: summary?.paid_out_kobo ?? 0, note: 'Collected to your bank' },
  ]

  const openDialog = () => {
    setAmount(available > 0 ? String(available / 100) : '')
    setFormError(null)
    setOpen(true)
  }

  const submit = async () => {
    const naira = Number(amount)
    if (!Number.isFinite(naira) || naira <= 0) return setFormError('Enter an amount.')
    const kobo = Math.round(naira * 100)
    if (kobo < min) return setFormError(`Minimum withdrawal is ${formatKobo(min)}.`)
    if (kobo > available) return setFormError('That is more than your available balance.')
    setFormError(null)
    try {
      await onRequestWithdrawal(kobo)
      setOpen(false)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not submit your request.')
    }
  }

  const statusTone = (status: string) => {
    if (status === 'PAID') return { bg: colors.successMuted, fg: colors.success }
    if (status === 'REJECTED' || status === 'FAILED') return { bg: colors.destructiveMuted, fg: colors.destructive }
    return { bg: colors.warningMuted, fg: colors.warning }
  }

  return (
    <View style={styles.root}>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <Card
            key={t.label}
            style={[
              styles.tile,
              t.highlight ? { borderColor: colors.primary, backgroundColor: colors.primaryMuted } : null,
            ]}
          >
            <Text style={[styles.tileLabel, { color: colors.mutedForeground }]}>{t.label}</Text>
            {loading ? (
              <Skeleton height={22} width="70%" />
            ) : (
              <Text style={[styles.tileValue, { color: colors.foreground }]}>{formatKobo(t.value)}</Text>
            )}
            <Text style={[styles.tileNote, { color: colors.subtleForeground }]}>{t.note}</Text>
          </Card>
        ))}
      </View>

      <Card style={styles.withdrawCard}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Withdraw funds</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Request up to your available balance (minimum {formatKobo(min)}). An AVDAN admin reviews each
          request and sends the approved amount to your saved bank account.
        </Text>
        {summary && !summary.has_payout_account ? (
          <Pressable onPress={onSetupAccount}>
            <Text style={[styles.body, { color: colors.destructive }]}>
              Add a payout bank account first — tap to set it up.
            </Text>
          </Pressable>
        ) : null}
        <Button
          label="Request withdrawal"
          onPress={openDialog}
          disabled={loading || !summary?.has_payout_account || available < min}
        />
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Withdrawal requests</Text>
      {requests.length === 0 ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>No withdrawal requests yet.</Text>
      ) : (
        requests.map((r) => {
          const tone = statusTone(r.status)
          return (
            <Card key={r.id} style={styles.row}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowAmount, { color: colors.foreground }]}>
                  {formatKobo(r.approved_kobo ?? r.requested_kobo)}
                </Text>
                <Badge label={STATUS_LABEL[r.status] ?? r.status} bg={tone.bg} fg={tone.fg} />
              </View>
              {r.approved_kobo != null && r.approved_kobo !== r.requested_kobo ? (
                <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
                  You asked for {formatKobo(r.requested_kobo)}
                </Text>
              ) : null}
              {r.decision_note ? (
                <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>{r.decision_note}</Text>
              ) : null}
              <Text style={[styles.rowDate, { color: colors.subtleForeground }]}>
                {formatDateTime(r.created_at)}
              </Text>
            </Card>
          )
        })
      )}

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Wallet activity</Text>
      {entries.length === 0 ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Earnings will appear here as your orders complete.
        </Text>
      ) : (
        entries.map((e) => (
          <Card key={e.id} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>
                {ENTRY_LABEL[e.kind] ?? e.kind}
              </Text>
              <Text
                style={[
                  styles.rowAmount,
                  { color: e.amount_kobo < 0 ? colors.mutedForeground : colors.success },
                ]}
              >
                {e.amount_kobo < 0 ? '−' : '+'}
                {formatKobo(Math.abs(e.amount_kobo))}
              </Text>
            </View>
            <Text style={[styles.rowDate, { color: colors.subtleForeground }]}>
              {formatDateTime(e.created_at)}
            </Text>
          </Card>
        ))
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : () => setOpen(false)} />
          <View
            style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.cardBorder }, shadowModal]}
          >
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>Request withdrawal</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              Available now: {formatKobo(available)}
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Amount in ₦"
              placeholderTextColor={colors.subtleForeground}
              style={[
                styles.input,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
              ]}
            />
            {formError ? <Text style={[styles.body, { color: colors.destructive }]}>{formError}</Text> : null}
            <View style={styles.actions}>
              <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} disabled={submitting} fullWidth={false} />
              <Button
                label={submitting ? 'Submitting…' : 'Submit'}
                onPress={submit}
                loading={submitting}
                fullWidth={false}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '47%', gap: spacing.xs },
  tileLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  tileValue: { fontFamily: fonts.display, fontSize: 18 },
  tileNote: { fontFamily: fonts.sans, fontSize: 11 },
  withdrawCard: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.display, fontSize: 16, marginTop: spacing.sm },
  body: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  row: { gap: spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  rowLabel: { fontFamily: fonts.sansMedium, fontSize: 14, flexShrink: 1 },
  rowAmount: { fontFamily: fonts.display, fontSize: 16 },
  rowDate: { fontFamily: fonts.sans, fontSize: 12 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  dialogTitle: { fontFamily: fonts.display, fontSize: 19 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
})
