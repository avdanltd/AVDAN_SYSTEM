import { Pressable, StyleSheet, View } from 'react-native'
import { Star } from 'lucide-react-native'

import { useTheme } from '../theme/context'

/** Five stars. Read-only by default; pass `onChange` to let someone choose a rating. */
export function StarRating({
  value,
  onChange,
  size = 16,
}: {
  value: number
  onChange?: (rating: number) => void
  size?: number
}) {
  const { colors } = useTheme()
  const rounded = Math.round(value)
  const amber = '#F59E0B'

  return (
    <View
      style={styles.row}
      accessibilityRole={onChange ? 'adjustable' : 'image'}
      accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= rounded
        const star = (
          <Star
            size={size}
            color={filled ? amber : colors.subtleForeground}
            fill={filled ? amber : 'transparent'}
          />
        )
        return onChange ? (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
            style={styles.hit}
          >
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  hit: { padding: 2 },
})
