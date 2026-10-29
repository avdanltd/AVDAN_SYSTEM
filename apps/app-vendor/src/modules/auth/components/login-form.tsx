import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react-native'
import { Button, fonts, loginSchema, radius, spacing, useLogin, useTheme } from '@avdan/mobile'

export function LoginForm() {
  const { mutate: login, isPending } = useLogin()
  const { colors } = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    const result = loginSchema.safeParse({ email: email.trim(), password })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input')
      return
    }
    setError(null)
    login(result.data)
  }

  const fieldStyle = (name: 'email' | 'password') => [
    styles.inputWrap,
    {
      backgroundColor: colors.card,
      borderColor: focused === name ? colors.primary : colors.border,
      borderWidth: focused === name ? 1.6 : 1,
    },
  ]

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
        <View style={fieldStyle('email')}>
          <Mail size={18} color={focused === 'email' ? colors.primary : colors.subtleForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={email}
            onChangeText={setEmail}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder="you@example.com"
            placeholderTextColor={colors.subtleForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
        <View style={fieldStyle('password')}>
          <Lock size={18} color={focused === 'password' ? colors.primary : colors.subtleForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={password}
            onChangeText={setPassword}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            placeholder="Enter your password"
            placeholderTextColor={colors.subtleForeground}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff size={18} color={colors.subtleForeground} />
            ) : (
              <Eye size={18} color={colors.subtleForeground} />
            )}
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.destructiveMuted }]}>
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        </View>
      ) : null}

      <Button
        label={isPending ? 'Signing in…' : 'Sign in'}
        onPress={handleSubmit}
        loading={isPending}
        size="lg"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontSize: 13, fontFamily: fonts.sansSemiBold, letterSpacing: 0.2 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  input: { flex: 1, fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  errorBox: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md },
  error: { fontSize: 13, fontFamily: fonts.sansMedium, lineHeight: 18 },
})
