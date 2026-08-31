import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { z } from 'zod'

import { useUpdateStorefront, useVendorProfile } from '../hooks/use-vendor'
import { Button, Card, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

// Mirrors UpdateVendorProfileRequest: name 1-255, description free text.
const storefrontSchema = z.object({
  name: z.string().trim().min(1, 'Your store needs a name').max(255, 'Name is too long'),
  description: z.string().trim().max(2000, 'Description is too long'),
})

export function StorefrontEdit() {
  const router = useRouter()
  const { colors } = useTheme()
  const { data: vendor, isLoading } = useVendorProfile()
  const { mutate: save, isPending } = useUpdateStorefront(() => router.back())

  const [name, setName] = useState(vendor?.name ?? '')
  const [description, setDescription] = useState(vendor?.description ?? '')
  const [focused, setFocused] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.card}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={48} />
          <Skeleton height={96} />
        </Card>
      </ScrollView>
    )
  }

  const dirty = name !== (vendor?.name ?? '') || description !== (vendor?.description ?? '')

  const handleSave = () => {
    const result = storefrontSchema.safeParse({ name, description })
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
    save({ name: result.data.name, description: result.data.description || null })
  }

  const fieldStyle = (key: string) => [
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
            <Text style={[styles.label, { color: colors.foreground }]}>Store name</Text>
            <View style={fieldStyle('name')}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. TechHub Electronics"
                placeholderTextColor={colors.subtleForeground}
              />
            </View>
            {errors.name ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{errors.name}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.foreground }]}>About your store</Text>
            <View style={[...fieldStyle('description'), styles.textareaWrap]}>
              <TextInput
                style={[styles.input, styles.textarea, { color: colors.foreground }]}
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocused('description')}
                onBlur={() => setFocused(null)}
                placeholder="Tell customers what you sell and what makes you different."
                placeholderTextColor={colors.subtleForeground}
                multiline
                textAlignVertical="top"
              />
            </View>
            {errors.description ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{errors.description}</Text>
            ) : null}
          </View>

          <View style={styles.readonly}>
            <Text style={[styles.readonlyLabel, { color: colors.mutedForeground }]}>Store link</Text>
            <Text style={[styles.readonlyValue, { color: colors.mutedForeground }]}>
              avdanstore.com/vendors/{vendor?.slug ?? '—'}
            </Text>
          </View>
          <Text style={[styles.hint, { color: colors.subtleForeground }]}>
            Your store link is generated from the name you first registered with and cannot be
            changed here.
          </Text>
        </Card>

        <Button
          label={isPending ? 'Saving…' : 'Save storefront'}
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
  textareaWrap: { minHeight: 110, paddingVertical: spacing.sm },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  textarea: { minHeight: 94 },
  error: { fontSize: 12.5, fontFamily: fonts.sansMedium },
  readonly: { gap: 4 },
  readonlyLabel: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  readonlyValue: { fontFamily: fonts.sans, fontSize: 15 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
})
