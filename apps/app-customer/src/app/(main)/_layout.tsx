import { Tabs } from 'expo-router'
import { Home, Package, ShoppingCart, Store, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fonts, useTheme } from '@avdan/mobile'

import { cartCount, useCartStore } from '@/modules/shop/store/cart.store'

// This app is publicly browsable — AVDAN is a storefront, not a members-only tool. Login is only
// required to actually buy (checkout) or to view account-specific data (orders, profile), each of
// which guards itself with <SignInGate> — see modules/shop/components/sign-in-gate.tsx. Do not
// re-add a blanket redirect here; that would force account creation just to look at products,
// which is a straightforward conversion killer for an e-commerce app. web-customer's proxy.ts
// already gets this right (`PROTECTED_PATHS = ['/orders', '/checkout', '/profile', ...]`,
// "Everything else is publicly browsable") — this mirrors that same per-route policy on mobile.
export default function MainLayout() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const lines = useCartStore((s) => s.lines)
  const count = cartCount(lines)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtleForeground,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="vendors"
        options={{ title: 'Stores', tabBarIcon: ({ color, size }) => <Store color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />,
          tabBarBadge: count > 0 ? count : undefined,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
      {/* Registered routes, hidden from the tab bar — reached via push, not a tab */}
      <Tabs.Screen name="products" options={{ href: null }} />
      <Tabs.Screen name="categories" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="checkout" options={{ href: null }} />
    </Tabs>
  )
}
