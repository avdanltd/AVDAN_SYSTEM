import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ImageOff, Plus } from 'lucide-react-native'
import { Card, fonts, formatKobo, radius, spacing, toast, useTheme } from '@avdan/mobile'

import { useCartStore } from '@/modules/shop/store/cart.store'
import type { Product } from '@/modules/shop/types'

export function ProductCard({ product, width }: { product: Product; width?: number }) {
  const { colors } = useTheme()
  const router = useRouter()
  const add = useCartStore((s) => s.add)

  const soldOut = !product.available || product.stock_qty === 0
  const image = product.image_urls?.[0]

  const handleAdd = () => {
    add(product)
    toast.success('Added to cart', product.name)
  }

  return (
    <Pressable
      onPress={() => router.push(`/products/${product.id}`)}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.imageWrap}>
          {image ? (
            <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageEmpty, { backgroundColor: colors.muted }]}>
              <ImageOff size={22} color={colors.subtleForeground} />
            </View>
          )}
          {soldOut ? (
            <View style={[styles.soldOut, { backgroundColor: colors.overlay }]}>
              <Text style={styles.soldOutText}>Sold out</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
            {product.name}
          </Text>
          <Text style={[styles.vendor, { color: colors.mutedForeground }]} numberOfLines={1}>
            {product.vendor_name}
          </Text>

          <View style={styles.footer}>
            <Text style={[styles.price, { color: colors.foreground }]}>
              {formatKobo(product.price_kobo)}
            </Text>
            {!soldOut ? (
              <Pressable
                onPress={handleAdd}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Add ${product.name} to cart`}
                style={({ pressed }) => [
                  styles.addBtn,
                  { backgroundColor: colors.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Plus size={16} color={colors.primaryForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  card: { padding: 0, overflow: 'hidden' },
  imageWrap: { width: '100%', aspectRatio: 1 },
  image: { width: '100%', height: '100%' },
  imageEmpty: { alignItems: 'center', justifyContent: 'center' },
  soldOut: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOutText: { color: '#fff', fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.4 },
  body: { padding: spacing.md, gap: 2 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14, lineHeight: 19 },
  vendor: { fontFamily: fonts.sans, fontSize: 12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  price: { fontFamily: fonts.display, fontSize: 16 },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
