import { useLocalSearchParams } from 'expo-router'
import { ProductDetail } from '@/modules/shop/components/product-detail'

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProductDetail productId={id} />
}
