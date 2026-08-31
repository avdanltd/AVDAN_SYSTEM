import { useState } from 'react'
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ImageOff, Minus, Package, Plus, Store } from 'lucide-react-native'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  fonts,
  formatKobo,
  radius,
  spacing,
  toast,
  useTheme,
} from '@avdan/mobile'

import { useProduct } from '../hooks/use-shop'
import { useCartStore } from '../store/cart.store'

const W = Dimensions.get('window').width

export function ProductDetail({ productId }: { productId: string }) {
  const { colors } = useTheme()
  const router = useRouter()
  const { data: product, isLoading, isError } = useProduct(productId)
  const add = useCartStore((s) => s.add)
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)

  if (isLoading) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Skeleton height={W} />
        <View style={styles.pad}>
          <Skeleton height={26} width="70%" />
          <Skeleton height={18} width="40%" />
          <Skeleton height={60} />
        </View>
      </ScrollView>
    )
  }

  if (isError || !product) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon={<Package size={30} color={colors.subtleForeground} />}
          title="Product unavailable"
          description="It may have been removed by the seller."
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  const soldOut = !product.available || product.stock_qty === 0
  const images = product.image_urls ?? []
  const max = Math.max(product.stock_qty, 1)

  const handleAdd = () => {
    add(product, quantity)
    toast.success('Added to cart', `${quantity} × ${product.name}`)
    router.push('/cart')
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Gallery */}
        {images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setImageIndex(Math.round(e.nativeEvent.contentOffset.x / W))
              }
            >
              {images.map((uri) => (
                <Image key={uri} source={{ uri }} style={styles.hero} resizeMode="cover" />
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={styles.dots}>
                {images.map((uri, i) => (
                  <View
                    key={uri}
                    style={[
                      styles.dot,
                      { backgroundColor: i === imageIndex ? colors.primary : colors.border },
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[styles.hero, styles.heroEmpty, { backgroundColor: colors.muted }]}>
            <ImageOff size={34} color={colors.subtleForeground} />
          </View>
        )}

        <View style={styles.pad}>
          <View style={styles.titleRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>{product.name}</Text>
            {product.category_name ? (
              <Badge
                label={product.category_name}
                bg={colors.primaryMuted}
                fg={colors.primary}
              />
            ) : null}
          </View>

          <Text style={[styles.price, { color: colors.foreground }]}>
            {formatKobo(product.price_kobo)}
          </Text>

          <Text
            style={[
              styles.stock,
              { color: soldOut ? colors.destructive : colors.mutedForeground },
            ]}
          >
            {soldOut ? 'Sold out' : `${product.stock_qty} available`}
          </Text>

          {/* Seller */}
          <Pressable
            onPress={() => router.push(`/vendors/${product.vendor_slug}`)}
            style={({ pressed }) => [
              styles.vendorRow,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && { opacity: 0.75 },
            ]}
          >
            <View style={[styles.vendorIcon, { backgroundColor: colors.primaryMuted }]}>
              <Store size={16} color={colors.primary} />
            </View>
            <View style={styles.vendorBody}>
              <Text style={[styles.vendorLabel, { color: colors.mutedForeground }]}>Sold by</Text>
              <Text style={[styles.vendorName, { color: colors.foreground }]} numberOfLines={1}>
                {product.vendor_name}
              </Text>
            </View>
          </Pressable>

          {product.description ? (
            <Card style={styles.descCard}>
              <Text style={[styles.descTitle, { color: colors.foreground }]}>Description</Text>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                {product.description}
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky buy bar */}
      <View
        style={[
          styles.buyBar,
          { backgroundColor: colors.background, borderTopColor: colors.border },
        ]}
      >
        {!soldOut ? (
          <View style={[styles.stepper, { borderColor: colors.border }]}>
            <Pressable
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              hitSlop={6}
              accessibilityLabel="Decrease quantity"
              style={styles.stepBtn}
            >
              <Minus size={16} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.qty, { color: colors.foreground }]}>{quantity}</Text>
            <Pressable
              onPress={() => setQuantity((q) => Math.min(max, q + 1))}
              hitSlop={6}
              accessibilityLabel="Increase quantity"
              style={styles.stepBtn}
            >
              <Plus size={16} color={colors.foreground} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.flex1}>
          <Button
            label={soldOut ? 'Sold out' : 'Add to cart'}
            onPress={handleAdd}
            disabled={soldOut}
            size="lg"
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  container: { paddingBottom: spacing.xxxl },
  hero: { width: W, height: W },
  heroEmpty: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    gap: 5,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pad: { padding: spacing.lg, gap: spacing.sm },
  titleRow: { gap: spacing.sm },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 31 },
  price: { fontFamily: fonts.display, fontSize: 26, marginTop: spacing.xs },
  stock: { fontFamily: fonts.sansMedium, fontSize: 13.5 },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  vendorIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorBody: { flex: 1, gap: 1 },
  vendorLabel: { fontFamily: fonts.sans, fontSize: 11.5 },
  vendorName: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  descCard: { gap: spacing.sm, marginTop: spacing.md },
  descTitle: { fontFamily: fonts.sansSemiBold, fontSize: 14.5 },
  desc: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 22 },
  buyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    height: 48,
  },
  stepBtn: { paddingHorizontal: spacing.md, height: '100%', justifyContent: 'center' },
  qty: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    minWidth: 24,
    textAlign: 'center',
  },
})
