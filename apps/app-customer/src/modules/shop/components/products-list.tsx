import { useMemo } from 'react'
import { Dimensions, FlatList, StyleSheet } from 'react-native'
import { Card, EmptyState, Skeleton, spacing, useTheme } from '@avdan/mobile'
import { ShoppingBag } from 'lucide-react-native'

import { ProductCard } from '@/components/product-card'
import { useProducts } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2

export function ProductsList() {
  const { colors } = useTheme()
  const { data, isLoading } = useProducts({ sort: 'newest', pageSize: 40 })
  const products = useMemo(() => data?.items ?? [], [data])

  if (isLoading) {
    return (
      <FlatList
        data={[0, 1, 2, 3, 4, 5]}
        numColumns={2}
        keyExtractor={(i) => String(i)}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        renderItem={() => (
          <Card style={{ width: CARD_W, gap: spacing.sm, padding: spacing.md }}>
            <Skeleton height={CARD_W} />
            <Skeleton height={14} width="80%" />
          </Card>
        )}
      />
    )
  }

  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={(p) => p.id}
      contentContainerStyle={products.length ? styles.list : styles.listEmpty}
      columnWrapperStyle={products.length ? styles.row : undefined}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      ListEmptyComponent={
        <EmptyState icon={<ShoppingBag size={30} color={colors.subtleForeground} />} title="No products yet" />
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: GUTTER, paddingBottom: spacing.xxxl, gap: GAP },
  row: { gap: GAP },
  listEmpty: { flexGrow: 1, justifyContent: 'center', padding: GUTTER },
})
