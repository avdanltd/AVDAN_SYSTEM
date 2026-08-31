import { useMemo, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight, PackagePlus, Search } from 'lucide-react-native'

import { useSetAvailability, useVendorProfile } from '../hooks/use-vendor'
import type { Product } from '../types'
import { Badge, Button, Card, EmptyState, Skeleton, fonts, formatKobo, radius, spacing, useTheme } from '@avdan/mobile'

function ProductRow({ product, onPress }: { product: Product; onPress: () => void }) {
  const { colors } = useTheme()
  const { mutate: setAvailability, isPending } = useSetAvailability()
  const outOfStock = product.stock_qty === 0
  const image = product.image_urls?.[0]

  return (
    <Card style={styles.row}>
      <Pressable onPress={onPress} style={styles.rowMain}>
        {image ? (
          <Image source={{ uri: image }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.muted }]}>
            <PackagePlus size={18} color={colors.subtleForeground} />
          </View>
        )}

        <View style={styles.rowBody}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
            {product.name}
          </Text>
          <Text style={[styles.price, { color: colors.foreground }]}>
            {formatKobo(product.price_kobo)}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[
                styles.stock,
                { color: outOfStock ? colors.destructive : colors.mutedForeground },
              ]}
            >
              {outOfStock ? 'Out of stock' : `${product.stock_qty} in stock`}
            </Text>
            {product.category_name ? (
              <Badge
                label={product.category_name}
                bg={colors.muted}
                fg={colors.mutedForeground}
              />
            ) : null}
          </View>
        </View>

        <ChevronRight size={16} color={colors.subtleForeground} />
      </Pressable>

      <View style={[styles.availabilityRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.availabilityLabel, { color: colors.mutedForeground }]}>
          {product.available ? 'Visible to customers' : 'Hidden from customers'}
        </Text>
        <Switch
          value={product.available}
          disabled={isPending}
          onValueChange={(available) => setAvailability({ productId: product.id, available })}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={colors.card}
        />
      </View>
    </Card>
  )
}

export function Catalog() {
  const router = useRouter()
  const { colors } = useTheme()
  const { data: profile, isLoading, isRefetching, refetch } = useVendorProfile()
  const [query, setQuery] = useState('')

  const products = useMemo(() => {
    const list = profile?.products ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category_name ?? '').toLowerCase().includes(q),
    )
  }, [profile, query])

  const hidden = useMemo(
    () => (profile?.products ?? []).filter((p) => !p.available).length,
    [profile],
  )

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View
          style={[
            styles.searchWrap,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Search size={16} color={colors.subtleForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search your products"
            placeholderTextColor={colors.subtleForeground}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <Button
          label="Add"
          icon={<PackagePlus size={16} color={colors.primaryForeground} />}
          onPress={() => router.push('/catalog/new')}
          fullWidth={false}
          size="sm"
        />
      </View>

      {hidden > 0 ? (
        <Text style={[styles.hiddenNote, { color: colors.mutedForeground }]}>
          {hidden} {hidden === 1 ? 'product is' : 'products are'} hidden from customers.
        </Text>
      ) : null}

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.row}>
              <Skeleton height={64} />
            </Card>
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={products.length ? styles.list : styles.listEmpty}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <ProductRow product={item} onPress={() => router.push(`/catalog/${item.id}`)} />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={<PackagePlus size={30} color={colors.subtleForeground} />}
              title={query ? 'No matches' : 'No products yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'Add your first product so customers can start ordering.'
              }
              action={
                query ? undefined : (
                  <Button
                    label="Add a product"
                    onPress={() => router.push('/catalog/new')}
                    fullWidth={false}
                  />
                )
              }
            />
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 14 },
  hiddenNote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  listEmpty: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  row: { padding: 0, overflow: 'hidden' },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { width: 56, height: 56, borderRadius: radius.sm },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  price: { fontFamily: fonts.display, fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  stock: { fontFamily: fonts.sans, fontSize: 12 },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  availabilityLabel: { fontFamily: fonts.sans, fontSize: 12.5 },
})
