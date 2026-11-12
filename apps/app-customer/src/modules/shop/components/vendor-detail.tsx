import { useMemo } from 'react'
import { ReviewsSection } from './reviews-section'
import { Dimensions, Image, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { MapPin, Star, Store as StoreIcon } from 'lucide-react-native'
import { formatVendorLocation } from '@avdan/types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { ProductCard } from '@/components/product-card'
import { useVendor } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2

export function VendorDetail({ slug }: { slug: string }) {
  const { colors } = useTheme()
  const router = useRouter()
  const { data: vendor, isLoading, isError } = useVendor(slug)

  const products = useMemo(
    () =>
      (vendor?.products ?? []).map((p) => ({
        ...p,
        category_id: null,
        vendor_id: vendor?.id ?? '',
        vendor_name: vendor?.name ?? '',
        vendor_slug: vendor?.slug ?? '',
        created_at: '',
        vendor_is_open: vendor?.is_open,
      })),
    [vendor],
  )

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={90} />
        <Skeleton height={20} width="60%" />
      </ScrollView>
    )
  }

  if (isError || !vendor) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<StoreIcon size={30} color={colors.subtleForeground} />}
          title="Store not found"
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.header}>
        <View style={styles.headerRow}>
          {vendor.logo_url ? (
            <Image source={{ uri: vendor.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoEmpty, { backgroundColor: colors.primaryMuted }]}>
              <StoreIcon size={26} color={colors.primary} />
            </View>
          )}
          <View style={styles.headerBody}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
              {vendor.name}
            </Text>
            <View style={styles.ratingRow}>
              <Star size={13} color={colors.accent} fill={colors.accent} />
              <Text style={[styles.rating, { color: colors.mutedForeground }]}>
                {(vendor.review_count ?? 0) > 0
                  ? `${vendor.rating.toFixed(1)} (${vendor.review_count})`
                  : 'No reviews yet'}
              </Text>
              {vendor.status === 'active' ? (
                vendor.is_open === false ? (
                  <Badge label="Closed" bg={colors.destructiveMuted} fg={colors.destructive} />
                ) : (
                  <Badge label="Open" bg={colors.successMuted} fg={colors.success} />
                )
              ) : null}
            </View>
            {formatVendorLocation(vendor.city, vendor.state) ? (
              <View style={styles.ratingRow}>
                <MapPin size={13} color={colors.mutedForeground} />
                <Text style={[styles.rating, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {formatVendorLocation(vendor.city, vendor.state)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {vendor.is_open === false ? (
          <Text style={[styles.desc, { color: colors.destructive }]}>
            This store is closed right now. You can browse, but new orders aren’t being taken.
          </Text>
        ) : null}
        {vendor.description ? (
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{vendor.description}</Text>
        ) : null}
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Products ({products.length})
      </Text>

      {products.length === 0 ? (
        <Card>
          <EmptyState title="No products yet" description="This store hasn't listed anything." />
        </Card>
      ) : (
        <View style={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} width={CARD_W} />
          ))}
        </View>
      )}

      <ReviewsSection target="vendor" id={vendor.id} title="Store reviews" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: GUTTER, gap: spacing.lg, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: { gap: spacing.md },
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: radius.md },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerBody: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rating: { fontFamily: fonts.sansMedium, fontSize: 13 },
  desc: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
})
