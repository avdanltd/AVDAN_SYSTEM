import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { MapPin, Star, Store as StoreIcon } from 'lucide-react-native'
import { formatVendorLocation } from '@avdan/types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { ProductCard } from '@/components/product-card'
import { useBusiness, useProducts } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2

/**
 * One brand, several branches. Each branch is its own store with its own products and pickup
 * point, so shopping always happens at a branch: choose one below, or browse products from all of
 * them (each product says which branch it comes from).
 */
export function BusinessDetail({ slug }: { slug: string }) {
  const { colors } = useTheme()
  const router = useRouter()
  const { data: biz, isLoading, isError } = useBusiness(slug)
  const { data: products } = useProducts({ businessSlug: slug, pageSize: 20 })

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={90} />
        <Skeleton height={20} width="60%" />
      </ScrollView>
    )
  }
  if (isError || !biz) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<StoreIcon size={30} color={colors.subtleForeground} />}
          title="Business not found"
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Card style={styles.header}>
        <View style={styles.headerRow}>
          {biz.logo_url ? (
            <Image source={{ uri: biz.logo_url }} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoEmpty, { backgroundColor: colors.primaryMuted }]}>
              <StoreIcon size={26} color={colors.primary} />
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.name, { color: colors.foreground }]}>{biz.name}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{biz.branch_count} branches</Text>
            {biz.review_count > 0 ? (
              <View style={styles.ratingRow}>
                <Star size={13} color={colors.accent} fill={colors.accent} />
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                  {biz.rating.toFixed(1)} ({biz.review_count})
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {biz.description ? <Text style={[styles.desc, { color: colors.mutedForeground }]}>{biz.description}</Text> : null}
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Branches</Text>
      {biz.branches.map((b) => {
        const place = formatVendorLocation(b.city, b.state)
        const closed = b.is_open === false
        return (
          <Pressable key={b.id} onPress={() => router.push(`/vendors/${b.slug}`)} style={({ pressed }) => pressed && { opacity: 0.75 }}>
            <Card style={styles.branch}>
              <View style={styles.branchTop}>
                <Text style={[styles.branchName, { color: colors.foreground }]} numberOfLines={2}>
                  {b.name}
                </Text>
                <Badge
                  label={closed ? 'Closed' : 'Open'}
                  bg={closed ? colors.destructiveMuted : colors.successMuted}
                  fg={closed ? colors.destructive : colors.success}
                />
              </View>
              {place ? (
                <View style={styles.placeRow}>
                  <MapPin size={13} color={colors.subtleForeground} />
                  <Text style={[styles.sub, { color: colors.mutedForeground }]}>{place}</Text>
                </View>
              ) : null}
              <Text style={[styles.link, { color: colors.primary }]}>Shop this branch</Text>
            </Card>
          </Pressable>
        )
      })}

      <Text style={[styles.section, { color: colors.foreground }]}>Products from all branches</Text>
      {!products || products.items.length === 0 ? (
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>These branches haven&apos;t listed anything yet.</Text>
      ) : (
        <View style={styles.grid}>
          {products.items.map((p) => (
            <ProductCard key={p.id} product={p} width={CARD_W} />
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: GUTTER, gap: spacing.md, paddingBottom: spacing.xxxl },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 64, height: 64, borderRadius: radius.lg },
  logoEmpty: { alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 20 },
  sub: { fontFamily: fonts.sans, fontSize: 12.5 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  desc: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 19 },
  section: { fontFamily: fonts.display, fontSize: 17, marginTop: spacing.sm },
  branch: { gap: 6 },
  branchTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  branchName: { fontFamily: fonts.sansSemiBold, fontSize: 15, flex: 1 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontFamily: fonts.sansSemiBold, fontSize: 12.5, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
})
