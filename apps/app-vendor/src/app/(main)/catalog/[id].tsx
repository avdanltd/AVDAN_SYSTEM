import { useLocalSearchParams } from 'expo-router'

import { ProductForm } from '@/modules/vendor/components/product-form'

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProductForm productId={id} />
}
