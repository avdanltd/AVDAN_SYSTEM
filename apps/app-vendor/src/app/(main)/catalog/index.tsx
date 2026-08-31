import { View } from 'react-native'

import { VendorHeader } from '@/components/vendor-header'
import { Catalog } from '@/modules/vendor/components/catalog'
import { useTheme } from '@avdan/mobile'
export default function CatalogScreen() {
  const { colors } = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VendorHeader title="Catalog" />
      <Catalog />
    </View>
  )
}
