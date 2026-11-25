import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { ORDER_GROUP_COLORS, bucketLabel } from '@avdan/types'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'
import { formatKobo } from '../lib/format'

interface Group { key: string; label: string; count: number }
interface Point { bucket: string; total: number; by_group: Record<string, number>; value_kobo?: number }
export interface OrderStatsData {
  bucket: string
  total: number
  value_kobo: number
  groups: Group[]
  series: Point[]
}

const compact = (kobo: number) => {
  const naira = kobo / 100
  if (naira >= 1_000_000) return `₦${(naira / 1_000_000).toFixed(1)}M`
  if (naira >= 1_000) return `₦${(naira / 1_000).toFixed(naira >= 10_000 ? 0 : 1)}k`
  return `₦${Math.round(naira)}`
}

/** 0..max in at most ~4 whole-number steps, so the grid lines land on readable numbers. */
function niceTicks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 4))
  const top = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = 0; v <= top; v += step) out.push(v)
  return out
}

function Caption({ title, hint }: { title: string; hint: string }) {
  const { colors } = useTheme()
  return (
    <View style={{ gap: 2 }}>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
    </View>
  )
}

/**
 * The order charts shared by the mobile apps, mirroring the web dashboards:
 *  1. orders per day/week/month, stacked by status, with a labelled axis; tap a bar for its breakdown;
 *  2. a donut of the status mix;
 *  3. the paid order value over time.
 */
export function OrderStatsCharts({ data, valueLabel }: { data: OrderStatsData; valueLabel: string }) {
  const { colors } = useTheme()
  const [width, setWidth] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  const unit = data.bucket
  const perUnit = unit === 'month' ? 'month' : unit === 'week' ? 'week' : 'day'
  const series = data.series
  const labelEvery = Math.max(1, Math.ceil(series.length / 6))

  const H = 170
  const m = { l: 30, r: 6, t: 8, b: 22 }
  const innerW = Math.max(width - m.l - m.r, 1)
  const innerH = H - m.t - m.b
  const yTicks = niceTicks(Math.max(1, ...series.map((p) => p.total)))
  const yMax = yTicks[yTicks.length - 1]
  const slot = innerW / Math.max(series.length, 1)
  const bw = Math.min(34, slot * 0.72)
  const y = (v: number) => m.t + innerH - (v / yMax) * innerH

  const mix = data.groups.filter((g) => g.count > 0)
  const mixTotal = mix.reduce((n, g) => n + g.count, 0)
  const R = 50
  const C = 2 * Math.PI * R
  let cum = 0

  const values = series.map((p) => p.value_kobo ?? 0)
  const hasValue = values.some((v) => v > 0)
  const vMax = Math.max(1, ...values)
  const vy = (v: number) => m.t + innerH - (v / vMax) * innerH
  const vx = (i: number) => m.l + (series.length <= 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
  const linePath = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${vx(i).toFixed(1)},${vy(v).toFixed(1)}`).join(' ')
  const areaPath = values.length
    ? `${linePath} L${vx(values.length - 1).toFixed(1)},${(m.t + innerH).toFixed(1)} L${vx(0).toFixed(1)},${(m.t + innerH).toFixed(1)} Z`
    : ''

  const sel = picked != null ? series[picked] : null

  return (
    <View style={{ gap: spacing.lg }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ gap: spacing.sm }}>
        <Caption
          title={`Orders per ${perUnit}`}
          hint="Each bar is one period; colours show where those orders stand. Tap a bar for details."
        />
        {width > 0 ? (
          <Svg width={width} height={H}>
            {yTicks.map((t) => (
              <G key={t}>
                <Line x1={m.l} x2={width - m.r} y1={y(t)} y2={y(t)} stroke={colors.border} strokeDasharray={t === 0 ? undefined : '3 3'} strokeWidth={1} />
                <SvgText x={m.l - 6} y={y(t) + 3.5} fontSize={10} fill={colors.subtleForeground} textAnchor="end">
                  {t}
                </SvgText>
              </G>
            ))}
            {series.map((p, i) => {
              const x = m.l + slot * i + (slot - bw) / 2
              let acc = 0
              return (
                <G key={p.bucket} opacity={picked == null || picked === i ? 1 : 0.45}>
                  {data.groups.map((g) => {
                    const n = p.by_group[g.key] ?? 0
                    if (!n) return null
                    const top = y(acc + n)
                    const h = y(acc) - top
                    acc += n
                    return <Rect key={g.key} x={x} y={top} width={bw} height={Math.max(h, 1)} fill={ORDER_GROUP_COLORS[g.key]} />
                  })}
                  {/* wide invisible target so a slim bar is still easy to tap */}
                  <Rect x={m.l + slot * i} y={m.t} width={slot} height={innerH} fill="transparent" onPress={() => setPicked(picked === i ? null : i)} />
                  {i % labelEvery === 0 ? (
                    <SvgText x={m.l + slot * i + slot / 2} y={H - 6} fontSize={9.5} fill={colors.subtleForeground} textAnchor="middle">
                      {bucketLabel(p.bucket, unit)}
                    </SvgText>
                  ) : null}
                </G>
              )
            })}
          </Svg>
        ) : null}
        {sel ? (
          <View style={[styles.detail, { backgroundColor: colors.muted }]}>
            <Text style={[styles.detailHead, { color: colors.foreground }]}>
              {bucketLabel(sel.bucket, unit)} · {sel.total} order{sel.total === 1 ? '' : 's'}
            </Text>
            {data.groups
              .filter((g) => (sel.by_group[g.key] ?? 0) > 0)
              .map((g) => (
                <View key={g.key} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: ORDER_GROUP_COLORS[g.key] }]} />
                  <Text style={[styles.rowText, { color: colors.foreground }]}>
                    {g.label}: {sel.by_group[g.key]}
                  </Text>
                </View>
              ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Caption title="Where your orders stand" hint="Share of all orders in this period, by status." />
        <View style={styles.donutRow}>
          <View style={styles.donut}>
            <Svg width={124} height={124} viewBox="0 0 124 124">
              <G rotation={-90} origin="62, 62">
                <Circle cx={62} cy={62} r={R} stroke={colors.muted} strokeWidth={20} fill="none" />
                {mix.map((g) => {
                  const len = (g.count / mixTotal) * C
                  const el = (
                    <Circle
                      key={g.key}
                      cx={62}
                      cy={62}
                      r={R}
                      stroke={ORDER_GROUP_COLORS[g.key]}
                      strokeWidth={20}
                      fill="none"
                      strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C - Math.max(len - 1.5, 0.5)}`}
                      strokeDashoffset={-cum}
                    />
                  )
                  cum += len
                  return el
                })}
              </G>
            </Svg>
            <View style={styles.donutCenter} pointerEvents="none">
              <Text style={[styles.donutTotal, { color: colors.foreground }]}>{data.total}</Text>
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>orders</Text>
            </View>
          </View>
          <View style={styles.legend}>
            {mix.map((g) => (
              <View key={g.key} style={styles.row}>
                <View style={[styles.dot, { backgroundColor: ORDER_GROUP_COLORS[g.key] }]} />
                <Text style={[styles.rowText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
                  {g.label}
                </Text>
                <Text style={[styles.rowText, { color: colors.mutedForeground }]}>
                  {g.count} · {mixTotal ? Math.round((g.count / mixTotal) * 100) : 0}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Caption
          title={`Money in ${valueLabel}`}
          hint={`${formatKobo(data.value_kobo)} in this period, per ${perUnit}. Unpaid and cancelled orders don't count.`}
        />
        {!hasValue ? (
          <Text style={[styles.hint, { color: colors.mutedForeground, paddingVertical: spacing.lg, textAlign: 'center' }]}>
            No paid orders in this period yet.
          </Text>
        ) : width > 0 ? (
          <Svg width={width} height={H - 30}>
            <Defs>
              <LinearGradient id="valFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ORDER_GROUP_COLORS.completed} stopOpacity={0.4} />
                <Stop offset="1" stopColor={ORDER_GROUP_COLORS.completed} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>
            {[0, 0.5, 1].map((f) => (
              <G key={f}>
                <Line x1={m.l} x2={width - m.r} y1={vy(vMax * f) } y2={vy(vMax * f)} stroke={colors.border} strokeDasharray={f === 0 ? undefined : '3 3'} />
                <SvgText x={m.l - 6} y={vy(vMax * f) + 3.5} fontSize={9.5} fill={colors.subtleForeground} textAnchor="end">
                  {compact(vMax * f)}
                </SvgText>
              </G>
            ))}
            <Path d={areaPath} fill="url(#valFill)" />
            <Path d={linePath} stroke={ORDER_GROUP_COLORS.completed} strokeWidth={2} fill="none" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.sansSemiBold, fontSize: 13.5 },
  hint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  detail: { borderRadius: radius.md, padding: spacing.md, gap: 4 },
  detailHead: { fontFamily: fonts.sansSemiBold, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowText: { fontFamily: fonts.sans, fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donut: { width: 124, height: 124 },
  donutCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutTotal: { fontFamily: fonts.display, fontSize: 24 },
  legend: { flex: 1, gap: 6 },
})
