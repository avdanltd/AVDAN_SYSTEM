import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Star, Store as StoreIcon } from 'lucide-react-native'
import { Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { useVendors } from '../hooks/use-shop'

export function VendorsList() {
  const { colors } = useTheme()
  const router = useRouter()
  const { data, isLoading } = useVendors()
  const vendors = data?.items ?? []

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {[0, 1, 2].map((i) => (
          <Card key={i} style={styles.row}>
            <Skeleton height={64} />
          </Card>
        ))}
      </ScrollView>
    )
  }

  if (vendors.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<StoreIcon size={30} color={colors.subtleForeground} />}
          title="No stores yet"
          description="Sellers will appear here once they join AVDAN."
        />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {vendors.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => router.push(`/vendors/${v.slug}`)}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Card style={styles.row}>
            {v.logo_url ? (
              <Image source={{ uri: v.logo_url }} style={styles.logo} />
            ) : (
              <View style={[styles.logo, styles.logoEmpty, { backgroundColor: colors.primaryMuted }]}>
                <StoreIcon size={20} color={colors.primary} />
              </View>
            )}
            <View style={styles.body}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {v.name}
              </Text>
              {v.description ? (
                <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {v.description}
                </Text>
              ) : null}
              <View style={styles.ratingRow}>
                <Star size={12} color={colors.accent} fill={colors.accent} />
                <Text style={[styles.rating, { color: colors.mutedForeground }]}>
                  {v.rating.toFixed(1)}
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  pressed: { opacity: 0.75 },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15.5 },
  desc: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 17 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontFamily: fonts.sansMedium, fontSize: 12 },
})
