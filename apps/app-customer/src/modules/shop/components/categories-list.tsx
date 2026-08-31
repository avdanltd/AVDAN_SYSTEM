import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Grid3x3 } from 'lucide-react-native'
import { Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { useCategories } from '../hooks/use-shop'

export function CategoriesList() {
  const { colors } = useTheme()
  const router = useRouter()
  const { data: categories, isLoading } = useCategories()

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={80} width="47%" />
        ))}
      </ScrollView>
    )
  }

  if (!categories || categories.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState icon={<Grid3x3 size={30} color={colors.subtleForeground} />} title="No categories yet" />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
      {categories.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => router.push(`/categories/${c.id}?name=${encodeURIComponent(c.name)}`)}
          style={({ pressed }) => [styles.tile, pressed && { opacity: 0.75 }]}
        >
          <Card style={styles.tileCard}>
            <Text style={[styles.tileName, { color: colors.foreground }]} numberOfLines={2}>
              {c.name}
            </Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  tile: { width: '47%' },
  tileCard: { minHeight: 80, justifyContent: 'center', borderRadius: radius.lg },
  tileName: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
})
