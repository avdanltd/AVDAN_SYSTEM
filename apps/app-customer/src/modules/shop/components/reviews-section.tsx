import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { Button, Card, Skeleton, StarRating, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { useReviews } from '../hooks/use-reviews'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Average, 5→1 breakdown and the written reviews for a product or a vendor. */
export function ReviewsSection({ target, id, title }: { target: 'product' | 'vendor'; id: string; title: string }) {
  const { colors } = useTheme()
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, isFetching } = useReviews(target, id, page)

  if (isLoading) return <Skeleton height={110} />
  if (isError || !data) {
    return <Text style={[styles.muted, { color: colors.mutedForeground }]}>Reviews could not be loaded right now.</Text>
  }
  const { summary } = data
  const pages = Math.max(1, Math.ceil(data.total / data.page_size))

  return (
    <Card style={styles.card}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {summary.count === 0 ? (
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>
          No reviews yet. Customers can review this after their order is delivered.
        </Text>
      ) : (
        <>
          <View style={styles.summary}>
            <View>
              <Text style={[styles.avg, { color: colors.foreground }]}>{summary.average.toFixed(1)}</Text>
              <StarRating value={summary.average} size={16} />
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                {summary.count} review{summary.count === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.bars}>
              {[5, 4, 3, 2, 1].map((n) => {
                const count = summary.distribution[String(n)] ?? 0
                return (
                  <View key={n} style={styles.barRow}>
                    <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{n}</Text>
                    <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                      <View style={[styles.barFill, { width: `${(count / summary.count) * 100}%` }]} />
                    </View>
                  </View>
                )
              })}
            </View>
          </View>

          {data.items.map((r) => (
            <View key={r.id} style={[styles.review, { borderTopColor: colors.border }]}>
              <View style={styles.reviewHead}>
                <StarRating value={r.rating} size={13} />
                <Text style={[styles.name, { color: colors.foreground }]}>{r.reviewer_name}</Text>
              </View>
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                Verified purchase · {formatDate(r.created_at)}
              </Text>
              {r.comment ? <Text style={[styles.comment, { color: colors.foreground }]}>{r.comment}</Text> : null}
            </View>
          ))}

          {pages > 1 && (
            <View style={styles.pager}>
              <Button label="Previous" variant="outline" size="sm" fullWidth={false} disabled={page <= 1 || isFetching} onPress={() => setPage(page - 1)} />
              <Text style={[styles.muted, { color: colors.mutedForeground }]}>
                {page} / {pages}
              </Text>
              <Button label="Next" variant="outline" size="sm" fullWidth={false} disabled={page >= pages || isFetching} onPress={() => setPage(page + 1)} />
            </View>
          )}
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16 },
  muted: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  summary: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center' },
  avg: { fontFamily: fonts.sansBold, fontSize: 32 },
  bars: { flex: 1, gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { width: 10, fontSize: 11, fontFamily: fonts.sans },
  barTrack: { flex: 1, height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#F59E0B' },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: 3 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  comment: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
})
