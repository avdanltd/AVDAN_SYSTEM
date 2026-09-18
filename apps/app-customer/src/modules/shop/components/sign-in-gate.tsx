import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { LogIn } from 'lucide-react-native'

import { Button, EmptyState, useSession, useTheme } from '@avdan/mobile'

interface SignInGateProps {
  /** What the user is trying to do — shown in the prompt, e.g. "view your orders". */
  action: string
  children: ReactNode
}

/**
 * Per-screen auth gate — this app is publicly browsable (see (main)/_layout.tsx's comment), so
 * login is required only for account-specific screens (orders, profile) and to complete a
 * purchase (checkout), never to look around. Renders an inline sign-in prompt instead of an
 * automatic redirect: the user tapped a real tab on purpose, so replacing that with a bare login
 * screen and no context reads as broken, not as a gate.
 */
export function SignInGate({ action, children }: SignInGateProps) {
  const { isAuthenticated } = useSession()
  const { colors } = useTheme()
  const router = useRouter()

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      <EmptyState
        icon={<LogIn size={22} color={colors.mutedForeground} />}
        title="Sign in required"
        description={`Sign in to ${action}.`}
        action={<Button label="Sign In" onPress={() => router.push('/login')} />}
      />
    </View>
  )
}
