import { useLocalSearchParams, useNavigation } from 'expo-router'
import { useLayoutEffect } from 'react'
import { CategoryProducts } from '@/modules/shop/components/category-products'

export default function CategoryProductsScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const navigation = useNavigation()

  useLayoutEffect(() => {
    navigation.setOptions({ title: name ?? 'Category' })
  }, [navigation, name])

  return <CategoryProducts categoryId={id} />
}
