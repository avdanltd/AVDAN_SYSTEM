import { useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Store as StoreIcon } from 'lucide-react-native'
import { Button, fonts, radius, spacing, toast, uploadImage, useTheme } from '@avdan/mobile'

import { useUpdateLogo } from '../hooks/use-vendor'

/**
 * The store logo customers see on the marketplace and the store page. Pick a square photo, it is
 * uploaded straight to storage and saved at once; "Remove" clears it.
 */
export function LogoPicker({ logoUrl }: { logoUrl: string | null | undefined }) {
  const { colors } = useTheme()
  const { mutate: saveLogo, isPending } = useUpdateLogo()
  const [uploading, setUploading] = useState(false)
  const busy = uploading || isPending

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      toast.error('Photo access needed', 'Allow photo access in Settings so you can choose a logo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (result.canceled) return
    const asset = result.assets[0]
    if (!asset?.fileSize) {
      toast.error('Could not read that image', 'Try a different photo.')
      return
    }
    setUploading(true)
    try {
      const { publicUrl } = await uploadImage({
        uri: asset.uri,
        fileSize: asset.fileSize,
        mimeType: asset.mimeType,
        prefix: 'vendor-logos',
      })
      if (!publicUrl) throw new Error('No image URL was returned.')
      saveLogo(publicUrl)
    } catch (e) {
      toast.error('Upload failed', e instanceof Error ? e.message : 'Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={styles.row}>
      {logoUrl ? (
        <Image source={{ uri: logoUrl }} style={[styles.logo, { borderColor: colors.border }]} />
      ) : (
        <View style={[styles.logo, styles.empty, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}>
          <StoreIcon size={28} color={colors.primary} />
        </View>
      )}
      <View style={styles.side}>
        <Text style={[styles.label, { color: colors.foreground }]}>Store logo</Text>
        <Text style={[styles.hint, { color: colors.subtleForeground }]}>
          Shown to customers on the marketplace and your store page. A square image works best.
        </Text>
        <View style={styles.actions}>
          <Button label={logoUrl ? 'Change logo' : 'Upload logo'} size="sm" variant="outline" fullWidth={false} onPress={pick} disabled={busy} />
          {logoUrl ? <Button label="Remove" size="sm" variant="ghost" fullWidth={false} onPress={() => saveLogo('')} disabled={busy} /> : null}
          {busy ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  logo: { width: 76, height: 76, borderRadius: radius.lg, borderWidth: 1 },
  empty: { alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, gap: 4 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 14 },
  hint: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
})
