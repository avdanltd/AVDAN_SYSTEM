import { useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImagePlus, Star, X } from 'lucide-react-native'
import { Button, fonts, radius, spacing, toast, uploadImage, useTheme } from '@avdan/mobile'

const MAX_IMAGES = 5

interface Props {
  value: string[]
  onChange: (urls: string[]) => void
}

/**
 * Product images. Picks from the library, uploads straight to R2 via a presigned PUT, and stores
 * the resulting CDN URLs.
 *
 * The first image is the one customers see in listings, so it is labelled and can be reordered by
 * promoting any image to the front — that is the only ordering that carries meaning, so a full
 * drag-to-reorder would be more machinery than the decision needs.
 */
export function ImagePickerField({ value, onChange }: Props) {
  const { colors } = useTheme()
  const [uploading, setUploading] = useState(false)

  const pickAndUpload = async () => {
    if (value.length >= MAX_IMAGES) {
      toast.info(`Up to ${MAX_IMAGES} images`, 'Remove one before adding another.')
      return
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access in Settings so you can attach product images.',
      )
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - value.length,
    })
    if (result.canceled) return

    setUploading(true)
    const uploaded: string[] = []
    try {
      for (const asset of result.assets) {
        if (!asset.fileSize) {
          // Without a real byte length the presigned signature cannot be built.
          toast.error('Could not read that image', 'Try a different photo.')
          continue
        }
        const { publicUrl } = await uploadImage({
          uri: asset.uri,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
          prefix: 'products',
        })
        if (publicUrl) uploaded.push(publicUrl)
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded])
        toast.success(uploaded.length === 1 ? 'Image added' : `${uploaded.length} images added`)
      }
    } catch (e) {
      toast.error('Upload failed', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const remove = (url: string) => {
    // The object is left in the bucket on purpose. Deleting here would orphan the image if the
    // product save is then cancelled, and an unreferenced object is cheap — see the cleanup
    // task in BACKLOG_HARMONISATION.md §2.
    onChange(value.filter((u) => u !== url))
  }

  const makePrimary = (url: string) => {
    onChange([url, ...value.filter((u) => u !== url)])
  }

  return (
    <View style={styles.wrap}>
      {value.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {value.map((url, i) => (
            <View key={url} style={styles.thumbWrap}>
              <Image source={{ uri: url }} style={[styles.thumb, { borderColor: colors.border }]} />

              {i === 0 ? (
                <View style={[styles.primaryTag, { backgroundColor: colors.primary }]}>
                  <Star size={9} color={colors.primaryForeground} fill={colors.primaryForeground} />
                  <Text style={[styles.primaryTagText, { color: colors.primaryForeground }]}>
                    Main
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => makePrimary(url)}
                  accessibilityLabel="Make this the main image"
                  style={[styles.makePrimary, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Star size={11} color={colors.mutedForeground} />
                </Pressable>
              )}

              <Pressable
                onPress={() => remove(url)}
                accessibilityLabel="Remove image"
                hitSlop={6}
                style={[styles.remove, { backgroundColor: colors.destructive }]}
              >
                <X size={11} color={colors.destructiveForeground} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {uploading ? (
        <View style={[styles.uploading, { borderColor: colors.border, backgroundColor: colors.muted }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.uploadingText, { color: colors.mutedForeground }]}>Uploading…</Text>
        </View>
      ) : (
        <Button
          label={value.length ? 'Add another image' : 'Add product images'}
          variant="outline"
          icon={<ImagePlus size={16} color={colors.foreground} />}
          onPress={pickAndUpload}
          disabled={value.length >= MAX_IMAGES}
        />
      )}

      <Text style={[styles.hint, { color: colors.subtleForeground }]}>
        {value.length
          ? `${value.length} of ${MAX_IMAGES}. The main image is what customers see first.`
          : `Up to ${MAX_IMAGES} images. JPEG, PNG or WebP, max 8 MB each.`}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  strip: { gap: spacing.md, paddingVertical: 2 },
  thumbWrap: { width: 92, height: 92 },
  thumb: { width: 92, height: 92, borderRadius: radius.md, borderWidth: 1 },
  primaryTag: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  primaryTagText: { fontFamily: fonts.sansSemiBold, fontSize: 9, letterSpacing: 0.3 },
  makePrimary: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  uploadingText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  hint: { fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 18 },
})
