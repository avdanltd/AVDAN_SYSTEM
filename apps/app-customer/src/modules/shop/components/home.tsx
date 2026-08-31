import { useMemo } from 'react'
import {
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, Search, ShoppingBag, Store } from 'lucide-react-native'
import { Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { ProductCard } from '@/components/product-card'
import { useCategories, useProducts, useVendors } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
// Two columns, sized from the window so cards line up exactly against the screen gutters
// rather than relying on percentage widths that drift with the gap.
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2

export function Home() {
  const { colors } = useTheme()
  const router = useRouter()

  const { data: categories, isLoading: catsLoading } = useCategories()
  const newest = useProducts({ sort: 'newest', pageSize: 6 })
  const { data: vendors } = useVendors()

  const products = useMemo(() => newest.data?.items ?? [], [newest.data])

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={newest.isRefetching}
          onRefresh={newest.refetch}
          tintColor={colors.primary}
        />
      }
    >
      {/* Search entry — a real screen, not an inline input, so results get room */}
      <Pressable
        onPress={() => router.push('/search')}
        style={({ pressed }) => [
          styles.searchBar,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Search size={17} color={colors.subtleForeground} />
        <Text style={[styles.searchText, { color: colors.subtleForeground }]}>
          Search products and stores
        </Text>
      </Pressable>

      {/* Categories */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Categories</Text>
      </View>
      {catsLoading ? (
        <View style={styles.chipRow}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={38} width={110} />
          ))}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(categories ?? []).map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/categories/${c.id}?name=${encodeURIComponent(c.name)}`)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colors.card, borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.chipText, { color: colors.foreground }]}>{c.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Stores */}
      <Pressable
        onPress={() => router.push('/vendors')}
        style={({ pressed }) => [
          styles.linkRow,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        <View style={[styles.linkIcon, { backgroundColor: colors.primaryMuted }]}>
          <Store size={17} color={colors.primary} />
        </View>
        <View style={styles.linkBody}>
          <Text style={[styles.linkTitle, { color: colors.foreground }]}>Browse stores</Text>
          <Text style={[styles.linkSub, { color: colors.mutedForeground }]}>
            {vendors?.total ?? '—'} sellers on AVDAN
          </Text>
        </View>
        <ChevronRight size={18} color={colors.subtleForeground} />
      </Pressable>

      {/* New arrivals */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>New arrivals</Text>
        <Pressable onPress={() => router.push('/products')} hitSlop={8}>
          <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
        </Pressable>
      </View>

      {newest.isLoading ? (
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} style={[{ width: CARD_W }, styles.skeletonCard]}>
              <Skeleton height={CARD_W} />
              <Skeleton height={14} width="80%" />
              <Skeleton height={14} width="50%" />
            </Card>
          ))}
        </View>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShoppingBag size={30} color={colors.subtleForeground} />}
            title="Nothing here yet"
            description="Products will appear as sellers add them."
          />
        </Card>
      ) : (
        <View style={styles.grid}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} width={CARD_W} />
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: GUTTER, gap: spacing.lg, paddingBottom: spacing.xxxl },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchText: { fontFamily: fonts.sans, fontSize: 15 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20 },
  sectionLink: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  chipRow: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 38,
    justifyContent: 'center',
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  linkIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBody: { flex: 1, gap: 1 },
  linkTitle: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  linkSub: { fontFamily: fonts.sans, fontSize: 12.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  skeletonCard: { gap: spacing.sm, padding: spacing.md },
})
