import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronDown, Grid3x3 } from 'lucide-react-native'
import { Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { useCategories } from '../hooks/use-shop'
import type { Category } from '../types'

function CategoryRow({ category, subs }: { category: Category; subs: Category[] }) {
  const { colors } = useTheme()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const go = (c: Category) => router.push(`/categories/${c.id}?name=${encodeURIComponent(c.name)}`)
  return (
    <Card style={styles.rowCard}>
      <View style={styles.rowHead}>
        <Pressable onPress={() => go(category)} style={({ pressed }) => [styles.rowMain, pressed && { opacity: 0.7 }]}>
          <Text style={[styles.tileName, { color: colors.foreground }]} numberOfLines={2}>
            {category.name}
          </Text>
        </Pressable>
        {subs.length > 0 ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${open ? 'Hide' : 'Show'} ${category.name} sub-categories`}
            accessibilityState={{ expanded: open }}
            style={styles.chevron}
          >
            <ChevronDown
              size={20}
              color={colors.mutedForeground}
              style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
            />
          </Pressable>
        ) : null}
      </View>
      {open
        ? subs.map((sub) => (
            <Pressable
              key={sub.id}
              onPress={() => go(sub)}
              style={({ pressed }) => [styles.subRow, { borderTopColor: colors.border }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.subName, { color: colors.mutedForeground }]}>{sub.name}</Text>
            </Pressable>
          ))
        : null}
    </Card>
  )
}

export function CategoriesList() {
  const { colors } = useTheme()
  const router = useRouter()
  const { data: categories, isLoading } = useCategories()

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={60} />
        ))}
      </ScrollView>
    )
  }

  if (!categories || categories.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<Grid3x3 size={30} color={colors.subtleForeground} />}
          title="No categories yet"
          description="Categories will show up here once vendors start listing products."
        />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
      {categories
        .filter((c) => !c.parent_id)
        .map((c) => (
          <CategoryRow key={c.id} category={c} subs={categories.filter((s) => s.parent_id === c.id)} />
        ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  rowCard: { borderRadius: radius.lg, padding: 0, overflow: 'hidden' },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
  chevron: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
  subRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md, paddingLeft: spacing.xl, paddingRight: spacing.lg },
  subName: { fontFamily: fonts.sansMedium, fontSize: 14 },
  tileName: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
})
