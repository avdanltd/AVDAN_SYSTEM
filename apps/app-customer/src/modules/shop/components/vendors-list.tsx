import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { Star, Store as StoreIcon } from 'lucide-react-native'
import { Button, Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { useVendors } from '../hooks/use-shop'
import { LocationFilter, type LocationValue } from './location-filter'

export function VendorsList() {
  const { colors } = useTheme()
  const router = useRouter()
  const [where, setWhere] = useState<LocationValue>({})
  const { data, isLoading, isError, refetch } = useVendors(where)
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

  if (isError) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<StoreIcon size={30} color={colors.subtleForeground} />}
          title="Couldn't load stores"
          description="Something went wrong. Please try again."
          action={<Button label="Retry" variant="outline" onPress={() => refetch()} fullWidth={false} />}
        />
      </View>
    )
  }

  const filtered = Boolean(where.state || where.lga || where.nearLat != null)

  if (vendors.length === 0) {
    return (
      <View style={styles.centered}>
        <LocationFilter value={where} onChange={setWhere} />
        <EmptyState
          icon={<StoreIcon size={30} color={colors.subtleForeground} />}
          title={filtered ? 'No stores here' : 'No stores yet'}
          description={
            filtered ? 'No sellers in that area yet. Try another place.' : 'Sellers will appear here once they join AVDAN.'
          }
        />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <LocationFilter value={where} onChange={setWhere} />
      {vendors.map((v) => {
        // A brand with several branches is one row ("Bokku Mart · 3 branches") that opens the business.
        const isBrand = (v.branch_count ?? 1) > 1 && Boolean(v.business_slug)
        const title = isBrand ? (v.business_name ?? v.name) : v.name
        return (
        <Pressable
          key={v.id}
          onPress={() => router.push((isBrand ? `/businesses/${v.business_slug}` : `/vendors/${v.slug}`) as Href)}
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
              <View style={styles.nameRow}>
                <Text style={[styles.name, styles.nameText, { color: colors.foreground }]} numberOfLines={1}>
                  {title}
                </Text>
                {isBrand ? (
                  <View style={[styles.branchBadge, { backgroundColor: colors.primaryMuted }]}>
                    <Text style={[styles.branchBadgeText, { color: colors.primary }]}>{v.branch_count} branches</Text>
                  </View>
                ) : null}
              </View>
              {/* Always two lines tall, so a one-line (or empty) description doesn't shrink the card. */}
              <Text style={[styles.desc, styles.descBox, { color: colors.mutedForeground }]} numberOfLines={2}>
                {isBrand ? (v.branch_places ?? []).join(' · ') : (v.description ?? '')}
              </Text>
              <View style={styles.ratingRow}>
                <Star size={12} color={colors.accent} fill={colors.accent} />
                <Text style={[styles.rating, { color: colors.mutedForeground }]}>
                  {(v.review_count ?? 0) > 0 ? `${v.rating.toFixed(1)} (${v.review_count})` : 'No reviews yet'}
                  {v.distance_km != null ? ` · ${v.distance_km} km away` : ''}
                </Text>
              </View>
            </View>
          </Card>
        </Pressable>
        )
      })}
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameText: { flexShrink: 1 },
  branchBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  branchBadgeText: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
  desc: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 17 },
  descBox: { minHeight: 34 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rating: { fontFamily: fonts.sansMedium, fontSize: 12 },
})
