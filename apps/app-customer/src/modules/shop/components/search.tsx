import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Search as SearchIcon, Store as StoreIcon, X } from 'lucide-react-native'
import { EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

import { ProductCard } from '@/components/product-card'
import { useSearch } from '../hooks/use-shop'

const GUTTER = spacing.lg
const GAP = spacing.md
const CARD_W = (Dimensions.get('window').width - GUTTER * 2 - GAP) / 2
const DEBOUNCE_MS = 350

export function Search() {
  const { colors } = useTheme()
  const router = useRouter()
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')

  // Debounced ourselves rather than pulling in a dependency for one effect: wait for the user
  // to pause typing before hitting the API, but keep the input itself instantly responsive.
  useEffect(() => {
    const t = setTimeout(() => setTerm(input), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [input])

  const { data, isLoading, isFetching } = useSearch(term)
  const products = useMemo(() => data?.products ?? [], [data])
  const vendors = useMemo(() => data?.vendors ?? [], [data])

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft size={22} color={colors.foreground} />
        </Pressable>
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <SearchIcon size={16} color={colors.subtleForeground} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={input}
            onChangeText={setInput}
            placeholder="Search products and stores"
            placeholderTextColor={colors.subtleForeground}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
          {input ? (
            <Pressable onPress={() => setInput('')} hitSlop={8} accessibilityLabel="Clear search">
              <X size={16} color={colors.subtleForeground} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {term.trim().length < 2 ? (
          <Text style={[styles.hint, { color: colors.subtleForeground }]}>
            Keep typing — search starts at 2 characters.
          </Text>
        ) : isLoading || isFetching ? (
          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={CARD_W} width={CARD_W} />
            ))}
          </View>
        ) : products.length === 0 && vendors.length === 0 ? (
          <EmptyState
            icon={<SearchIcon size={30} color={colors.subtleForeground} />}
            title="No results"
            description={`Nothing matched "${term}".`}
          />
        ) : (
          <>
            {vendors.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Stores</Text>
                {vendors.map((v) => (
                  <Pressable
                    key={v.id}
                    onPress={() => router.push(`/vendors/${v.slug}`)}
                    style={({ pressed }) => [
                      styles.vendorRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    {v.logo_url ? (
                      <Image source={{ uri: v.logo_url }} style={styles.vendorLogo} />
                    ) : (
                      <View style={[styles.vendorLogo, styles.vendorLogoEmpty, { backgroundColor: colors.primaryMuted }]}>
                        <StoreIcon size={16} color={colors.primary} />
                      </View>
                    )}
                    <Text style={[styles.vendorName, { color: colors.foreground }]} numberOfLines={1}>
                      {v.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {products.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Products</Text>
                <View style={styles.grid}>
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} width={CARD_W} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 42,
  },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 14.5 },
  container: { padding: GUTTER, gap: spacing.lg, paddingBottom: spacing.xxxl },
  hint: { fontFamily: fonts.sans, fontSize: 13.5, textAlign: 'center', marginTop: spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  section: { gap: spacing.md },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17 },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  vendorLogo: { width: 36, height: 36, borderRadius: radius.sm },
  vendorLogoEmpty: { alignItems: 'center', justifyContent: 'center' },
  vendorName: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14.5 },
})
