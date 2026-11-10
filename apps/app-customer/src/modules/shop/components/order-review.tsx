import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'

import { Button, Card, Skeleton, StarRating, fonts, radius, spacing, useTheme } from '@avdan/mobile'
import type { SubmitReviewsInput } from '@avdan/types'

import { useOrderReviews, useSubmitReviews } from '../hooks/use-reviews'

interface Draft {
  rating: number
  comment: string
}
const EMPTY: Draft = { rating: 0, comment: '' }

/** "How was your order?" — shown once an order has ended (delivered, refunded, cancelled…).
 *  Each product and the vendor can be rated once; anything already rated is read-only. */
export function OrderReview({ orderId }: { orderId: string }) {
  const { colors } = useTheme()
  const { data, isLoading } = useOrderReviews(orderId)
  const submit = useSubmitReviews(orderId)
  const [vendor, setVendor] = useState<Draft>(EMPTY)
  const [products, setProducts] = useState<Record<string, Draft>>({})

  if (isLoading) return <Skeleton height={90} />
  if (!data || !data.eligible) return null

  const draft = (id: string): Draft => products[id] ?? EMPTY
  const pending = data.products.filter((p) => !p.review)
  const vendorPending = !data.vendor
  const nothingLeft = pending.length === 0 && !vendorPending

  const productReviews = pending
    .filter((p) => draft(p.product_id).rating > 0)
    .map((p) => ({
      product_id: p.product_id,
      rating: draft(p.product_id).rating,
      comment: draft(p.product_id).comment.trim() || null,
    }))
  const chosen: SubmitReviewsInput = {
    vendor: vendorPending && vendor.rating > 0 ? { rating: vendor.rating, comment: vendor.comment.trim() || null } : null,
    products: productReviews,
  }
  const canSubmit = !!chosen.vendor || productReviews.length > 0

  const row = (label: string, value: Draft, onChange: (d: Draft) => void, placeholder: string) => (
    <View style={styles.draft}>
      <StarRating value={value.rating} size={26} onChange={(rating) => onChange({ ...value, rating })} />
      {value.rating > 0 ? (
        <TextInput
          style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
          value={value.comment}
          onChangeText={(comment) => onChange({ ...value, comment })}
          placeholder={placeholder}
          placeholderTextColor={colors.subtleForeground}
          multiline
          maxLength={1000}
          accessibilityLabel={`${label} comment`}
        />
      ) : null}
    </View>
  )

  const readonly = (rating: number, comment: string | null) => (
    <View style={styles.draft}>
      <StarRating value={rating} size={16} />
      {comment ? <Text style={[styles.comment, { color: colors.mutedForeground }]}>{comment}</Text> : null}
    </View>
  )

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.foreground }]}>{nothingLeft ? 'Your review' : 'How was your order?'}</Text>
      {!nothingLeft ? (
        <Text style={[styles.comment, { color: colors.mutedForeground }]}>
          Your honest feedback helps other customers and helps vendors improve.
        </Text>
      ) : null}

      <Text style={[styles.name, { color: colors.foreground }]}>{data.vendor_name ?? 'The vendor'}</Text>
      {data.vendor
        ? readonly(data.vendor.rating, data.vendor.comment)
        : row(`Rate ${data.vendor_name ?? 'the vendor'}`, vendor, setVendor, 'How was the service and delivery? (optional)')}

      {data.products.map((p) => (
        <View key={p.product_id} style={[styles.product, { borderTopColor: colors.border }]}>
          <Text style={[styles.name, { color: colors.foreground }]}>{p.product_name}</Text>
          {p.review
            ? readonly(p.review.rating, p.review.comment)
            : row(
                `Rate ${p.product_name}`,
                draft(p.product_id),
                (d) => setProducts((cur) => ({ ...cur, [p.product_id]: d })),
                'What did you think of this product? (optional)',
              )}
        </View>
      ))}

      {!nothingLeft ? (
        <Button
          label={submit.isPending ? 'Saving…' : 'Submit review'}
          disabled={!canSubmit}
          loading={submit.isPending}
          onPress={() => submit.mutate(chosen)}
        />
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16 },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  comment: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19 },
  draft: { gap: spacing.sm },
  product: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
    fontFamily: fonts.sans,
    fontSize: 14,
    textAlignVertical: 'top',
  },
})
