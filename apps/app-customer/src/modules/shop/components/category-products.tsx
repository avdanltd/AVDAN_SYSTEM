import { useMemo } from 'react'
import { Dimensions, FlatList, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Button, Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'
import { Grid3x3 } from 'lucide-react-native'

import { ProductCard } from '@/components/product-card'
import { useCategories, useProducts } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2

export function CategoryProducts({ categoryId }: { categoryId: string }) {
  const { colors } = useTheme()
  const router = useRouter()
  const { data, isLoading } = useProducts({ categoryId, pageSize: 40 })
  const products = useMemo(() => data?.items ?? [], [data])
  const { data: categories } = useCategories()
  const subs = useMemo(() => (categories ?? []).filter((c) => c.parent_id === categoryId), [categories, categoryId])

  if (isLoading) {
    return (
      <FlatList
        data={[0, 1, 2, 3]}
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
      ListHeaderComponent={
        subs.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: spacing.md }}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {subs.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => router.push(`/categories/${c.id}?name=${encodeURIComponent(c.name)}`)}
                style={({ pressed }) => [
                  {
                    borderWidth: 1,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.md,
                    paddingVertical: 8,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={{ fontFamily: fonts.sansMedium, fontSize: 13, color: colors.foreground }}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null
      }
      renderItem={({ item }) => <ProductCard product={item} width={CARD_W} />}
      ListEmptyComponent={
        <EmptyState
          icon={<Grid3x3 size={30} color={colors.subtleForeground} />}
          title="No products in this category yet"
          description="Vendors haven't listed anything here yet. Check back soon."
          action={
            <Button
              label="Browse all products"
              variant="outline"
              fullWidth={false}
              onPress={() => router.push('/products')}
            />
          }
        />
      }
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: GUTTER, paddingBottom: spacing.xxxl, gap: GAP },
  row: { gap: GAP },
  listEmpty: { flexGrow: 1, justifyContent: 'center', padding: GUTTER },
})
