import { CategoryProductsPage } from '@/modules/categories/components/category-products-page'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return {
    title: `${name} — AVDAN`,
    description: `Browse ${name} products on AVDAN.`,
  }
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <CategoryProductsPage slug={slug} />
}
