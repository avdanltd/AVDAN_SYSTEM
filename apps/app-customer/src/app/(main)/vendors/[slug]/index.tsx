import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'
import { VendorDetail } from '@/modules/shop/components/vendor-detail'

export default function VendorDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const navigation = useNavigation()

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Store' })
  }, [navigation])

  return <VendorDetail slug={slug} />
}
