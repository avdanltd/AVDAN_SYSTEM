import { useMemo, useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Check, Trash2 } from 'lucide-react-native'
import { z } from 'zod'

import { ImagePickerField } from './image-picker-field'
import {
  useCategories,
  useCreateProduct,
  useDeleteProduct,
  useUpdateProduct,
  useVendorProfile,
} from '../hooks/use-vendor'
import { Button, Card, EmptyState, Skeleton, fonts, radius, spacing, useTheme } from '@avdan/mobile'

/**
 * Mirrors CreateProductRequest in services/vendor/schemas.py: name 1-255, price_kobo > 0,
 * stock_qty >= 0. Price is entered in naira and converted to kobo on submit — every monetary
 * value crossing the API is an integer number of kobo.
 */
const productSchema = z.object({
  name: z.string().trim().min(1, 'Give the product a name').max(255, 'Name is too long'),
  description: z.string().trim().max(2000, 'Description is too long').optional(),
  priceNaira: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), 'Enter a price like 4500 or 4500.50')
    .refine((v) => Number(v) > 0, 'Price must be greater than zero'),
  stock: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v), 'Stock must be a whole number'),
  categoryId: z.string().min(1, 'Choose a category'),
})

/**
 * Defined at module scope on purpose. Declaring this inside ProductForm would give it a new
 * component identity on every render, remounting the TextInput it wraps and dismissing the
 * keyboard after each keystroke.
 */
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.subtleForeground }]}>{hint}</Text>
      ) : null}
    </View>
  )
}

interface Props {
  /** Omit to create a new product. */
  productId?: string
}

export function ProductForm({ productId }: Props) {
  const router = useRouter()
  const { colors } = useTheme()
  const { data: profile, isLoading: profileLoading } = useVendorProfile()
  const { data: categories, isLoading: categoriesLoading } = useCategories()

  const existing = useMemo(
    () => (productId ? profile?.products?.find((p) => p.id === productId) : undefined),
    [profile, productId],
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [priceNaira, setPriceNaira] = useState(
    existing ? String(existing.price_kobo / 100) : '',
  )
  const [stock, setStock] = useState(existing ? String(existing.stock_qty) : '0')
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '')
  const [imageUrls, setImageUrls] = useState<string[]>(existing?.image_urls ?? [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focused, setFocused] = useState<string | null>(null)

  const create = useCreateProduct(() => router.back())
  const update = useUpdateProduct(productId ?? '', () => router.back())
  const remove = useDeleteProduct(() => router.back())

  const isPending = create.isPending || update.isPending || remove.isPending

  if (productId && (profileLoading || !profile)) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Card style={styles.skeletonCard}>
          <Skeleton height={20} width="40%" />
          <Skeleton height={48} />
          <Skeleton height={20} width="40%" />
          <Skeleton height={48} />
        </Card>
      </ScrollView>
    )
  }

  if (productId && !existing) {
    return (
      <View style={styles.centered}>
        <EmptyState
          title="Product not found"
          description="It may have been removed from your catalog."
          action={<Button label="Go back" variant="outline" onPress={() => router.back()} fullWidth={false} />}
        />
      </View>
    )
  }

  const handleSubmit = () => {
    const result = productSchema.safeParse({
      name,
      description: description || undefined,
      priceNaira,
      stock,
      categoryId,
    })
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})

    const payload = {
      name: result.data.name,
      description: result.data.description ?? null,
      // Naira -> kobo. Math.round guards against float drift on values like 4500.55.
      price_kobo: Math.round(Number(result.data.priceNaira) * 100),
      stock_qty: Number(result.data.stock),
      image_urls: imageUrls,
      category_id: result.data.categoryId,
    }

    if (productId) update.mutate(payload)
    else create.mutate(payload)
  }

  const confirmDelete = () => {
    Alert.alert('Remove this product?', 'Customers will no longer see it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(productId!) },
    ])
  }

  const fieldStyle = (key: string) => [
    styles.inputWrap,
    {
      backgroundColor: colors.card,
      borderColor: errors[key] ? colors.destructive : focused === key ? colors.primary : colors.border,
      borderWidth: focused === key || errors[key] ? 1.6 : 1,
    },
  ]

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Field label="Product name" error={errors.name}>
            <View style={fieldStyle('name')}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
                placeholder="e.g. Samsung Galaxy A15"
                placeholderTextColor={colors.subtleForeground}
              />
            </View>
          </Field>

          <Field label="Description" error={errors.description} hint="Optional, but it helps customers decide.">
            <View style={[...fieldStyle('description'), styles.textareaWrap]}>
              <TextInput
                style={[styles.input, styles.textarea, { color: colors.foreground }]}
                value={description}
                onChangeText={setDescription}
                onFocus={() => setFocused('description')}
                onBlur={() => setFocused(null)}
                placeholder="What makes this product worth buying?"
                placeholderTextColor={colors.subtleForeground}
                multiline
                textAlignVertical="top"
              />
            </View>
          </Field>

          <View style={styles.pairRow}>
            <View style={styles.flex1}>
              <Field label="Price (₦)" error={errors.priceNaira}>
                <View style={fieldStyle('priceNaira')}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={priceNaira}
                    onChangeText={setPriceNaira}
                    onFocus={() => setFocused('priceNaira')}
                    onBlur={() => setFocused(null)}
                    placeholder="4500"
                    placeholderTextColor={colors.subtleForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </Field>
            </View>
            <View style={styles.flex1}>
              <Field label="Stock" error={errors.stock}>
                <View style={fieldStyle('stock')}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={stock}
                    onChangeText={setStock}
                    onFocus={() => setFocused('stock')}
                    onBlur={() => setFocused(null)}
                    placeholder="0"
                    placeholderTextColor={colors.subtleForeground}
                    keyboardType="number-pad"
                  />
                </View>
              </Field>
            </View>
          </View>

          <Field label="Images">
            <ImagePickerField value={imageUrls} onChange={setImageUrls} />
          </Field>

          <Field label="Category" error={errors.categoryId}>
            {categoriesLoading ? (
              <Skeleton height={40} />
            ) : (
              <View style={styles.chips}>
                {(categories ?? []).map((c) => {
                  const selected = categoryId === c.id
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryId(c.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selected ? colors.primary : colors.muted,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {selected ? <Check size={13} color={colors.primaryForeground} /> : null}
                      <Text
                        style={[
                          styles.chipText,
                          { color: selected ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {c.name}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </Field>
        </Card>

        <Button
          label={productId ? 'Save changes' : 'Add product'}
          onPress={handleSubmit}
          loading={isPending}
          size="lg"
        />

        {productId ? (
          <Button
            label="Remove product"
            variant="destructive"
            icon={<Trash2 size={16} color={colors.destructiveForeground} />}
            onPress={confirmDelete}
            disabled={isPending}
          />
        ) : null}

        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flex1: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  container: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.lg },
  skeletonCard: { gap: spacing.md },
  field: { gap: spacing.sm },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.2 },
  inputWrap: { borderRadius: radius.md, paddingHorizontal: spacing.lg, minHeight: 52, justifyContent: 'center' },
  textareaWrap: { minHeight: 96, paddingVertical: spacing.sm },
  input: { fontSize: 15, fontFamily: fonts.sans, paddingVertical: spacing.md },
  textarea: { minHeight: 80 },
  error: { fontSize: 12.5, fontFamily: fonts.sansMedium },
  hint: { fontSize: 12.5, fontFamily: fonts.sans },
  pairRow: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 38,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13 },
})
