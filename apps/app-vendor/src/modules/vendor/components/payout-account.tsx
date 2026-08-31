import { useMemo, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { BadgeCheck, Building2, Check, Search, ShieldCheck, X } from 'lucide-react-native'
import { Badge, Button, Card, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import {
  useBanks,
  usePayoutAccount,
  useSavePayoutAccount,
  useVerifyAccount,
} from '../hooks/use-vendor'
import type { Bank } from '../types'

/**
 * Payout account setup.
 *
 * Deliberately verify-before-save: the vendor picks a bank and types an account number, we
 * resolve it to the real account name through Paystack, and only after they confirm that name is
 * it saved. Typing a digit wrong is easy and the consequence — money going to a stranger — is not
 * recoverable, so the confirmation step is the point of the screen rather than friction.
 */
export function PayoutAccount() {
  const { colors } = useTheme()
  const router = useRouter()

  const { data: existing, isLoading } = usePayoutAccount()
  const { data: banks, isLoading: banksLoading } = useBanks()
  const verify = useVerifyAccount()
  const save = useSavePayoutAccount(() => router.back())

  const [bank, setBank] = useState<Bank | null>(null)
  const [accountNumber, setAccountNumber] = useState('')
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const filteredBanks = useMemo(() => {
    const list = banks ?? []
    const q = query.trim().toLowerCase()
    return q ? list.filter((b) => b.name.toLowerCase().includes(q)) : list
  }, [banks, query])

  const numberValid = /^\d{10}$/.test(accountNumber)
  const canVerify = !!bank && numberValid && !verify.isPending

  const handleVerify = () => {
    if (!bank) return
    setResolvedName(null)
    verify.mutate(
      { accountNumber, bankCode: bank.code },
      { onSuccess: (r) => setResolvedName(r.account_name) },
    )
  }

  const handleSave = () => {
    if (!bank || !resolvedName) return
    save.mutate({
      account_number: accountNumber,
      bank_code: bank.code,
      bank_name: bank.name,
      account_name: resolvedName,
    })
  }

  // Changing either input invalidates a previously resolved name — otherwise the vendor could
  // confirm one account and save a different number.
  const onChangeNumber = (v: string) => {
    setAccountNumber(v.replace(/\D/g, '').slice(0, 10))
    setResolvedName(null)
  }
  const onPickBank = (b: Bank) => {
    setBank(b)
    setResolvedName(null)
    setPickerOpen(false)
    setQuery('')
  }

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <Skeleton height={20} width="45%" />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </Card>
      </ScrollView>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {existing?.has_payout_account ? (
          <Card style={styles.currentCard}>
            <View style={styles.currentHead}>
              <BadgeCheck size={18} color={colors.success} />
              <Text style={[styles.currentTitle, { color: colors.foreground }]}>
                Payout account active
              </Text>
            </View>
            <Text style={[styles.currentLine, { color: colors.foreground }]}>
              {existing.account_name}
            </Text>
            <Text style={[styles.currentMeta, { color: colors.mutedForeground }]}>
              {existing.bank_name} ·{' '}
              {existing.account_number ? `••••${existing.account_number.slice(-4)}` : '—'}
            </Text>
            <Text style={[styles.hint, { color: colors.subtleForeground }]}>
              Fill the form below to replace it.
            </Text>
          </Card>
        ) : (
          <Card style={[styles.warnCard, { backgroundColor: colors.warningMuted }]}>
            <Text style={[styles.warnTitle, { color: colors.foreground }]}>
              No payout account yet
            </Text>
            <Text style={[styles.warnBody, { color: colors.mutedForeground }]}>
              Your earnings stay in escrow until a verified bank account is on file. Add one to
              start receiving payouts.
            </Text>
          </Card>
        )}

        <Card style={styles.card}>
          {/* Bank */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Bank</Text>
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={banksLoading}
              style={({ pressed }) => [
                styles.select,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Building2 size={17} color={colors.subtleForeground} />
              <Text
                style={[
                  styles.selectText,
                  { color: bank ? colors.foreground : colors.subtleForeground },
                ]}
                numberOfLines={1}
              >
                {banksLoading ? 'Loading banks…' : (bank?.name ?? 'Choose your bank')}
              </Text>
            </Pressable>
          </View>

          {/* Account number */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Account number</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: colors.card,
                  borderColor: focused ? colors.primary : colors.border,
                  borderWidth: focused ? 1.6 : 1,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={accountNumber}
                onChangeText={onChangeNumber}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="0123456789"
                placeholderTextColor={colors.subtleForeground}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
            <Text style={[styles.hint, { color: colors.subtleForeground }]}>
              {accountNumber.length}/10 digits
            </Text>
          </View>

          {/* Resolved name — the confirmation step */}
          {resolvedName ? (
            <View style={[styles.resolved, { backgroundColor: colors.successMuted }]}>
              <ShieldCheck size={17} color={colors.success} />
              <View style={styles.resolvedBody}>
                <Text style={[styles.resolvedLabel, { color: colors.mutedForeground }]}>
                  Account name
                </Text>
                <Text style={[styles.resolvedName, { color: colors.foreground }]}>
                  {resolvedName}
                </Text>
              </View>
            </View>
          ) : null}

          {resolvedName ? (
            <Button
              label={save.isPending ? 'Saving…' : 'Confirm and save'}
              onPress={handleSave}
              loading={save.isPending}
              size="lg"
            />
          ) : (
            <Button
              label={verify.isPending ? 'Verifying…' : 'Verify account'}
              onPress={handleVerify}
              loading={verify.isPending}
              disabled={!canVerify}
              size="lg"
            />
          )}

          <Text style={[styles.footnote, { color: colors.subtleForeground }]}>
            We check the account name with your bank before saving. Money is only ever sent to the
            name shown above.
          </Text>
        </Card>
      </ScrollView>

      {/* Bank picker */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHead, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Choose your bank</Text>
            <Pressable onPress={() => setPickerOpen(false)} hitSlop={10} accessibilityLabel="Close">
              <X size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <View
              style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Search size={16} color={colors.subtleForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Search banks"
                placeholderTextColor={colors.subtleForeground}
                autoCorrect={false}
                autoFocus
              />
            </View>
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={(b) => b.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selected = bank?.code === item.code
              return (
                <Pressable
                  onPress={() => onPickBank(item)}
                  style={({ pressed }) => [
                    styles.bankRow,
                    { borderBottomColor: colors.border },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <Text style={[styles.bankName, { color: colors.foreground }]}>{item.name}</Text>
                  {selected ? <Check size={18} color={colors.primary} /> : null}
                </Pressable>
              )
            }}
            ListEmptyComponent={
              <Text style={[styles.emptyBanks, { color: colors.mutedForeground }]}>
                No banks match “{query}”.
              </Text>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.lg },
  currentCard: { gap: 4 },
  currentHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  currentTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  currentLine: { fontFamily: fonts.display, fontSize: 18 },
  currentMeta: { fontFamily: fonts.sans, fontSize: 13 },
  warnCard: { gap: spacing.xs },
  warnTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  warnBody: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.2 },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  selectText: { flex: 1, fontFamily: fonts.sans, fontSize: 15 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 15, paddingVertical: spacing.md },
  hint: { fontFamily: fonts.sans, fontSize: 12.5 },
  resolved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  resolvedBody: { flex: 1, gap: 1 },
  resolvedLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  resolvedName: { fontFamily: fonts.sansSemiBold, fontSize: 15.5 },
  footnote: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  modal: { flex: 1, paddingTop: spacing.xxxl },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontFamily: fonts.display, fontSize: 20 },
  searchRow: { padding: spacing.lg },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  bankName: { flex: 1, fontFamily: fonts.sans, fontSize: 15 },
  emptyBanks: {
    fontFamily: fonts.sans,
    fontSize: 14,
    textAlign: 'center',
    padding: spacing.xxl,
  },
})
