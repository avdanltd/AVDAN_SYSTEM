import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ORDER_GROUP_COLORS, bucketLabel, presetRange, type RangePreset } from '@avdan/types'
import { Card, Skeleton, fonts, formatKobo, radius, spacing, useTheme } from '@avdan/mobile'

import { useOrderStats } from '../hooks/use-vendor'

const PRESET_CHOICES: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

const CHART_HEIGHT = 120

/**
 * Orders at a glance: how many in the chosen period, split by where they stand (awaiting payment,
 * in progress, delivered, release pending, completed, cancelled, disputes), with a stacked
 * histogram by day, week or month. Tap a status to narrow the chart to it.
 */
export function OrderHistogram() {
  const { colors } = useTheme()
  const [preset, setPreset] = useState<RangePreset>('30d')
  const [group, setGroup] = useState('')

  const range = presetRange(preset)
  const params: Record<string, string> = {}
  if (range.from) params.date_from = range.from
  if (range.to) params.date_to = range.to
  if (group) params.group = group

  const { data, isLoading, isError } = useOrderStats(params)
  const unit = data?.bucket ?? 'day'
  const series = data?.series ?? []
  const max = Math.max(1, ...series.map((p) => p.total))
  const labelEvery = Math.max(1, Math.ceil(series.length / 6))

  return (
    <Card style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {PRESET_CHOICES.map((p) => {
          const on = preset === p.value
          return (
            <Pressable
              key={p.value}
              onPress={() => setPreset(p.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.pill, { backgroundColor: on ? colors.primary : colors.muted }]}
            >
              <Text style={[styles.pillText, { color: on ? colors.primaryForeground : colors.foreground }]}>{p.label}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isError ? (
        <Text style={[styles.err, { color: colors.destructive }]}>Couldn&apos;t load your order numbers.</Text>
      ) : (
        <>
          <View>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>Orders in this period</Text>
            {isLoading ? (
              <Skeleton height={34} width={80} />
            ) : (
              <Text style={[styles.total, { color: colors.foreground }]}>{data?.total ?? 0}</Text>
            )}
            {data ? (
              <Text style={[styles.sub, { color: colors.subtleForeground }]}>
                {formatKobo(data.value_kobo)} in paid orders (your prices)
              </Text>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {(data?.groups ?? []).map((g) => {
              const on = group === g.key
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setGroup(on ? '' : g.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.chip,
                    { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: ORDER_GROUP_COLORS[g.key] }]} />
                  <Text style={[styles.chipText, { color: on ? colors.primaryForeground : colors.foreground }]}>
                    {g.label} {g.count}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={{ height: CHART_HEIGHT + 18 }}>
            {isLoading ? (
              <Skeleton height={CHART_HEIGHT} />
            ) : (data?.total ?? 0) === 0 ? (
              <View style={[styles.empty, { height: CHART_HEIGHT }]}>
                <Text style={[styles.sub, { color: colors.mutedForeground }]}>No orders in this period.</Text>
              </View>
            ) : (
              <View style={styles.bars}>
                {series.map((p, i) => (
                  <View key={p.bucket} style={styles.barCol}>
                    <View style={[styles.stack, { height: (p.total / max) * CHART_HEIGHT }]}>
                      {Object.entries(p.by_group).map(([key, n]) => (
                        <View key={key} style={{ flex: n, backgroundColor: ORDER_GROUP_COLORS[key] }} />
                      ))}
                    </View>
                    <Text style={[styles.axis, { color: colors.subtleForeground }]} numberOfLines={1}>
                      {i % labelEvery === 0 ? bucketLabel(p.bucket, unit) : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  pillRow: { gap: spacing.sm, paddingRight: spacing.md },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  pillText: { fontFamily: fonts.sansSemiBold, fontSize: 12.5 },
  sub: { fontFamily: fonts.sans, fontSize: 12.5 },
  total: { fontFamily: fonts.display, fontSize: 30 },
  err: { fontFamily: fonts.sans, fontSize: 13 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 5 },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: CHART_HEIGHT + 18 },
  barCol: { flex: 1, minWidth: 0, justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  stack: { width: '100%', flexDirection: 'column-reverse', borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden', minHeight: 2 },
  axis: { fontFamily: fonts.sans, fontSize: 9.5, width: '100%', textAlign: 'center', height: 12 },
})
