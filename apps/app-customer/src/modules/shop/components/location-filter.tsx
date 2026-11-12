import { useState } from 'react'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { Crosshair, X } from 'lucide-react-native'
import { lgasForState, NIGERIA_STATES } from '@avdan/types'
import { fonts, radius, spacing, toast, useTheme } from '@avdan/mobile'

export interface LocationValue {
  state?: string
  lga?: string
  nearLat?: number
  nearLng?: number
}

function Chip({
  label,
  active,
  onPress,
  disabled,
  icon,
}: {
  label: string
  active?: boolean
  onPress: () => void
  disabled?: boolean
  icon?: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.chip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primaryMuted : colors.card,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {icon}
      <Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Filter stores / products by State, Local Government, or "Near me" (closest first). Sits above a
 * list; the parent owns the value and passes it into its query.
 */
export function LocationFilter({
  value,
  onChange,
}: {
  value: LocationValue
  onChange: (next: LocationValue) => void
}) {
  const { colors } = useTheme()
  const [picker, setPicker] = useState<'state' | 'lga' | null>(null)
  const [locating, setLocating] = useState(false)
  const near = value.nearLat != null && value.nearLng != null
  const active = Boolean(value.state || value.lga || near)
  const options: readonly string[] = picker === 'state' ? NIGERIA_STATES : value.state ? lgasForState(value.state) : []

  async function toggleNear() {
    if (near) {
      onChange({ ...value, nearLat: undefined, nearLng: undefined })
      return
    }
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        toast.error('Location is off', 'Allow location access to see stores near you.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      onChange({ ...value, nearLat: pos.coords.latitude, nearLng: pos.coords.longitude })
    } catch {
      toast.error('Could not get your location', 'Please try again.')
    } finally {
      setLocating(false)
    }
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Chip
          label={locating ? 'Locating…' : near ? 'Nearest to me' : 'Near me'}
          active={near}
          disabled={locating}
          onPress={toggleNear}
          icon={<Crosshair size={14} color={near ? colors.primary : colors.mutedForeground} />}
        />
        <Chip label={value.state ?? 'State'} active={!!value.state} onPress={() => setPicker('state')} />
        <Chip
          label={value.lga ?? 'Local government'}
          active={!!value.lga}
          disabled={!value.state}
          onPress={() => setPicker('lga')}
        />
        {active ? (
          <Chip
            label="Clear"
            onPress={() => onChange({})}
            icon={<X size={14} color={colors.mutedForeground} />}
          />
        ) : null}
      </ScrollView>

      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              {picker === 'state' ? 'Choose a state' : 'Choose a local government'}
            </Text>
            <FlatList
              data={['All', ...options]}
              keyExtractor={(o) => o}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    const pick = item === 'All' ? undefined : item
                    onChange(picker === 'state' ? { ...value, state: pick, lga: undefined } : { ...value, lga: pick })
                    setPicker(null)
                  }}
                >
                  <Text style={[styles.optionText, { color: colors.foreground }]}>{item}</Text>
                </Pressable>
              )}
            />
            <Pressable onPress={() => setPicker(null)} style={styles.close}>
              <Text style={[styles.optionText, { color: colors.primary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  sheetTitle: { fontFamily: fonts.sansSemiBold, fontSize: 16, marginBottom: spacing.sm },
  option: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  optionText: { fontFamily: fonts.sansMedium, fontSize: 15 },
  close: { paddingVertical: 16, alignItems: 'center' },
})
