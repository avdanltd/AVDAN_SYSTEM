import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { ChevronDown, Search, X } from 'lucide-react-native'
import { lgasForState, NIGERIA_COUNTRY, NIGERIA_STATES, type AddressValue } from '@avdan/types'

import { fonts, radius, spacing } from '../theme/tokens'
import { useTheme } from '../theme/context'

/**
 * Street, town/city, country, state, local government and landmark — one box each, the RN
 * counterpart of `@avdan/ui`'s `AddressFields`. State and local government open a searchable
 * list (the local government list depends on the chosen state). Nigeria only for now.
 */
export function AddressFields({
  value,
  onChange,
  error,
}: {
  value: AddressValue
  onChange: (next: AddressValue) => void
  error?: string | null
}) {
  const { colors } = useTheme()
  const [picker, setPicker] = useState<'state' | 'lga' | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch })

  const box = (key: string) => [
    styles.box,
    {
      backgroundColor: colors.card,
      borderColor: focused === key ? colors.primary : colors.border,
      borderWidth: focused === key ? 1.6 : 1,
    },
  ]

  const textField = (
    key: 'street' | 'city' | 'landmark',
    label: string,
    placeholder: string,
    maxLength: number,
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={box(key)}>
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={value[key]}
          onChangeText={(text) => set({ [key]: text })}
          onFocus={() => setFocused(key)}
          onBlur={() => setFocused(null)}
          placeholder={placeholder}
          placeholderTextColor={colors.subtleForeground}
          maxLength={maxLength}
        />
      </View>
    </View>
  )

  const selectField = (
    kind: 'state' | 'lga',
    label: string,
    current: string,
    placeholder: string,
    disabled: boolean,
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setPicker(kind)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.box,
          styles.select,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
        ]}
      >
        <Text
          style={[styles.selectText, { color: current ? colors.foreground : colors.subtleForeground }]}
          numberOfLines={1}
        >
          {current || placeholder}
        </Text>
        <ChevronDown size={17} color={colors.subtleForeground} />
      </Pressable>
    </View>
  )

  return (
    <View style={styles.wrap}>
      {textField('street', 'Street number and name', 'e.g. 12 Adeola Odeku Street', 200)}
      {textField('city', 'Town / City', 'e.g. Sango-Ota', 100)}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.foreground }]}>Country</Text>
        <View style={[styles.box, styles.select, { backgroundColor: colors.card, borderColor: colors.border, opacity: 0.7 }]}>
          <Text style={[styles.selectText, { color: colors.foreground }]}>{NIGERIA_COUNTRY}</Text>
        </View>
      </View>
      {selectField('state', 'State', value.state, 'Select state', false)}
      {selectField(
        'lga',
        'Local government',
        value.lga,
        value.state ? 'Select local government' : 'Select a state first',
        !value.state,
      )}
      {textField('landmark', 'Landmark (optional)', 'e.g. Opposite the market', 200)}
      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
        The landmark is optional, but it helps with better routing.
      </Text>
      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      <OptionPicker
        visible={picker !== null}
        title={picker === 'state' ? 'Select state' : 'Select local government'}
        options={picker === 'state' ? NIGERIA_STATES : lgasForState(value.state)}
        selected={picker === 'state' ? value.state : value.lga}
        onClose={() => setPicker(null)}
        onPick={(option) => {
          if (picker === 'state') set({ state: option, lga: '' })
          else set({ lga: option })
          setPicker(null)
        }}
      />
    </View>
  )
}

function OptionPicker({
  visible,
  title,
  options,
  selected,
  onClose,
  onPick,
}: {
  visible: boolean
  title: string
  options: readonly string[]
  selected: string
  onClose: () => void
  onPick: (option: string) => void
}) {
  const { colors } = useTheme()
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [options, query])

  const close = () => {
    setQuery('')
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.modal, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHead, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
            <X size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>
        <View style={styles.searchRow}>
          <View style={[styles.box, styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={16} color={colors.subtleForeground} />
            <TextInput
              style={[styles.input, { color: colors.foreground, flex: 1 }]}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.subtleForeground}
              autoCorrect={false}
            />
          </View>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(o) => o}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={[styles.hint, { color: colors.mutedForeground, padding: spacing.lg }]}>
              Nothing matches &ldquo;{query}&rdquo;.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setQuery('')
                onPick(item)
              }}
              style={({ pressed }) => [
                styles.row,
                { borderBottomColor: colors.border },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text
                style={[
                  styles.rowText,
                  { color: item === selected ? colors.primary : colors.foreground },
                  item === selected && { fontFamily: fonts.sansSemiBold },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.lg },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.2 },
  box: { borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, justifyContent: 'center' },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderWidth: 1 },
  selectText: { flex: 1, fontSize: 15, fontFamily: fonts.sans },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
  error: { fontSize: 12.5, fontFamily: fonts.sansMedium },
  modal: { flex: 1 },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xxxl,
    borderBottomWidth: 1,
  },
  modalTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17 },
  searchRow: { padding: spacing.lg },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1 },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { fontFamily: fonts.sans, fontSize: 15 },
})
