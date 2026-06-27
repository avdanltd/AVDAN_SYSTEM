'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ShoppingBag, ChevronLeft, ChevronRight } from 'lucide-react'
import { CategoryIcon } from '@avdan/ui'
import {
  Button,
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useProducts } from '@/modules/products/hooks/use-products'
import { useCategories } from '@/modules/categories/hooks/use-categories'
import { useVendors } from '@/modules/vendors/hooks/use-vendors'
import { ProductGrid } from '@/modules/products/components/product-grid'
import { VendorCard } from '@/modules/vendors/components/vendor-card'
import { VendorCardSkeleton } from '@/modules/vendors/components/vendor-card-skeleton'
import { ProductCardSkeleton } from '@/modules/products/components/product-card-skeleton'
import { cn } from '@avdan/ui'

// Hero slides — Unsplash CDN images with Nigerian market / ecommerce feel
const HERO_SLIDES = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1600&q=80&fit=crop',
    headline: 'Shop from top local vendors',
    subline: 'Fresh products, fast delivery. Discover the best vendors near you.',
    cta: { label: 'Shop Now', href: ROUTES.products },
    ctaSecondary: { label: 'Browse Vendors', href: ROUTES.vendors },
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80&fit=crop',
    headline: 'Fresh food at your doorstep',
    subline: 'Order from local food vendors and get it delivered fast.',
    cta: { label: 'Browse Food', href: `${ROUTES.categories}/food-groceries` },
    ctaSecondary: { label: 'All Products', href: ROUTES.products },
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80&fit=crop',
    headline: 'Electronics & gadgets',
    subline: 'Find the latest tech from trusted vendors across Lagos.',
    cta: { label: 'Shop Electronics', href: `${ROUTES.categories}/electronics` },
    ctaSecondary: { label: 'View All', href: ROUTES.products },
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&q=80&fit=crop',
    headline: 'Fashion & style',
    subline: 'Discover clothing and accessories from top fashion vendors.',
    cta: { label: 'Shop Fashion', href: `${ROUTES.categories}/fashion-clothing` },
    ctaSecondary: { label: 'All Vendors', href: ROUTES.vendors },
  },
]

function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const onSelect = useCallback(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
  }, [api])

  useEffect(() => {
    if (!api) return
    onSelect()
    api.on('select', onSelect)
    api.on('reInit', onSelect)
    return () => {
      api.off('select', onSelect)
      api.off('reInit', onSelect)
    }
  }, [api, onSelect])

  // Auto-play every 5 seconds
  useEffect(() => {
    if (!api) return
    const interval = setInterval(() => {
      api.scrollNext()
    }, 5000)
    return () => clearInterval(interval)
  }, [api])

  return (
    <div className="relative -mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: 'start' }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {HERO_SLIDES.map((slide) => (
            <CarouselItem key={slide.id} className="pl-0">
              <div className="relative h-[420px] w-full overflow-hidden sm:h-[520px] lg:h-[600px]">
                {/* Background image */}
                <Image
                  src={slide.image}
                  alt={slide.headline}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={slide.id === 1}
                />
                {/* Dark overlay for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/20" />

                {/* Slide content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="mx-auto w-full max-w-8xl px-6 sm:px-8 lg:px-12">
                    <div className="max-w-xl">
                      <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
                        {slide.headline}
                      </h1>
                      <p className="mt-4 text-base text-white/80 sm:text-lg lg:text-xl">
                        {slide.subline}
                      </p>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button size="lg" asChild className="bg-white text-foreground hover:bg-white/90">
                          <Link href={slide.cta.href}>
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            {slide.cta.label}
                          </Link>
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          asChild
                          className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                        >
                          <Link href={slide.ctaSecondary.href}>{slide.ctaSecondary.label}</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Prev / Next arrows */}
        <button
          onClick={() => api?.scrollPrev()}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => api?.scrollNext()}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/40"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Dot indicators */}
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === current ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80',
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </Carousel>
    </div>
  )
}

function SectionHeader({
  title,
  href,
  linkLabel = 'View all',
}: {
  title: string
  href: string
  linkLabel?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

function CategoryGrid() {
  const { data: categories, isLoading } = useCategories()

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="h-16 w-16 animate-pulse rounded-2xl bg-secondary" />
            <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    )
  }

  if (!categories?.length) return null

  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={ROUTES.category(cat.slug)}
          className="group flex flex-col items-center gap-2 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary transition-all duration-200 group-hover:bg-primary/10 group-hover:scale-105">
            <CategoryIcon name={cat.icon} className="h-7 w-7 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="line-clamp-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
            {cat.name}
          </span>
        </Link>
      ))}
    </div>
  )
}

export function StoreHomePage() {
  const { data: featuredData, isLoading: loadingFeatured } = useProducts({ sort: 'popular', limit: 8 })
  const { data: newArrivalsData, isLoading: loadingNew } = useProducts({ sort: 'newest', limit: 8 })
  const { data: vendorsData, isLoading: loadingVendors } = useVendors({ limit: '4', status: 'active' })

  return (
    <div>
      {/* Hero carousel */}
      <HeroCarousel />

      {/* Content sections */}
      <div className="space-y-12 py-12">
        {/* Category Grid */}
        <section className="space-y-5">
          <SectionHeader title="Shop by Category" href={ROUTES.categories} />
          <CategoryGrid />
        </section>

        {/* Featured Products */}
        <section className="space-y-5">
          <SectionHeader title="Popular Right Now" href={ROUTES.products} />
          {loadingFeatured ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <ProductGrid products={featuredData?.items} loading={false} />
          )}
        </section>

        {/* Top Vendors */}
        <section className="space-y-5">
          <SectionHeader title="Top Vendors" href={ROUTES.vendors} />
          {loadingVendors ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <VendorCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {vendorsData?.items?.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          )}
        </section>

        {/* New Arrivals */}
        <section className="space-y-5">
          <SectionHeader title="New Arrivals" href={`${ROUTES.products}?sort=newest`} />
          {loadingNew ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <ProductGrid products={newArrivalsData?.items} loading={false} />
          )}
        </section>

        {/* CTA strip — image background */}
        <section className="relative -mx-4 overflow-hidden sm:-mx-6 lg:-mx-8">
          <div className="relative h-56 sm:h-64">
            <Image
              src="https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1600&q=80&fit=crop"
              alt="Browse all categories"
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-primary/70" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Explore all categories
              </h2>
              <p className="mt-2 text-white/80 sm:text-lg">
                From electronics to fashion — find exactly what you need.
              </p>
              <Button size="lg" asChild className="mt-6 bg-white text-foreground hover:bg-white/90">
                <Link href={ROUTES.categories}>Browse all categories</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
