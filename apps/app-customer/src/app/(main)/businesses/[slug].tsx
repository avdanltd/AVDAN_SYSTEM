import { useLocalSearchParams } from 'expo-router'
import { BusinessDetail } from '@/modules/shop/components/business-detail'

export default function BusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  return <BusinessDetail slug={slug} />
}
