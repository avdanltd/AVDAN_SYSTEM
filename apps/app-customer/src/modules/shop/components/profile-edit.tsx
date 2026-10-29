import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { z } from 'zod'
import { Button, Card, fonts, radius, spacing, useSession, useTheme, useUpdateProfile } from '@avdan/mobile'

// Matches what PATCH /auth/me accepts (UpdateProfileRequest: name, phone).
const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Enter a valid phone number, e.g. +2348012345678'),
})

export function ProfileEdit() {
  const { user } = useSession()
  const { colors } = useTheme()
  const router = useRouter()
  const { mutate: save, isPending } = useUpdateProfile(() => router.back())

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [focused, setFocused] = useState<'name' | 'phone' | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dirty = name !== (user?.name ?? '') || phone !== (user?.phone ?? '')

  const handleSave = () => {
    const result = profileSchema.safeParse({ name, phone })
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    // Only send what actually changed — phone is uniqueness-checked server-side and a
    // no-op resend would still hit that check.
    const payload: { name?: string; phone?: string } = {}
    if (result.data.name !== user?.name) payload.name = result.data.name
    if (result.data.phone !== user?.phone) payload.phone = result.data.phone
    save(payload)
  }

  const field = (key: 'name' | 'phone') => [
    styles.inputWrap,
    {
      backgroundColor: colors.card,
      borderColor: errors[key] ? colors.destructive : focused === key ? colors.primary : colors.border,
      borderWidth: focused === key || errors[key] ? 1.6 : 1,
    },
  ]

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Full name</Text>
            <View style={field('name')}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Amaka Obi"
                placeholderTextColor={colors.subtleForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            {errors.name ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{errors.name}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
            <View style={field('phone')}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={setPhone}
                onFocus={() => setFocused('phone')}
                onBlur={() => setFocused(null)}
                placeholder="+2348012345678"
                placeholderTextColor={colors.subtleForeground}
                keyboardType="phone-pad"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
            {errors.phone ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{errors.phone}</Text>
            ) : null}
          </View>

          <View style={styles.readonly}>
            <Text style={[styles.readonlyLabel, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.readonlyValue, { color: colors.mutedForeground }]}>
              {user?.email ?? '—'}
            </Text>
          </View>
          <Text style={[styles.hint, { color: colors.subtleForeground }]}>
            Your email is used to sign in and cannot be changed here. Ask an administrator if it
            needs updating.
          </Text>
        </Card>

        <Button
          label={isPending ? 'Saving…' : 'Save changes'}
          onPress={handleSave}
          loading={isPending}
          disabled={!dirty}
          size="lg"
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  card: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.2 },
  inputWrap: { borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  error: { fontSize: 12.5, fontFamily: fonts.sansMedium },
  readonly: { gap: 4 },
  readonlyLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  readonlyValue: { fontFamily: fonts.sans, fontSize: 15 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
})
