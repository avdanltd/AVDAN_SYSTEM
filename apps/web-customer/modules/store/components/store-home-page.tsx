'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { ArrowRight, ShoppingBag, ChevronLeft, ChevronRight, Search, Truck } from 'lucide-react'
import { CategoryIcon, EmptyState } from '@avdan/ui'
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
    // Replaced — the original photo was a flat-lay that was ~80% pure black background, nearly
    // invisible under any legibility scrim (STATUS_DESIGN.md §6). This one is an actual market
    // scene with warm light and a real vendor at a stall — reads correctly in both themes.
    image: 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=1600&q=80&fit=crop',
    eyebrow: 'Fresh On AVDAN',
    headline: 'Shop from top',
    headlineAccent: 'local vendors.',
    subline: 'Fresh products, fast delivery. Discover the best vendors near you.',
    cta: { label: 'Shop Now', href: ROUTES.products },
    ctaSecondary: { label: 'Browse Vendors', href: ROUTES.vendors },
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&q=80&fit=crop',
    eyebrow: 'Doorstep Delivery',
    headline: 'Fresh food,',
    headlineAccent: 'delivered fast.',
    subline: 'Order from local food vendors and get it delivered fast.',
    cta: { label: 'Browse Food', href: `${ROUTES.categories}/food-groceries` },
    ctaSecondary: { label: 'All Products', href: ROUTES.products },
  },
  {
    id: 3,
    // Replaced — the original photo was a clothing boutique interior, mismatched with an
    // "Electronics & gadgets" slide (STATUS_DESIGN.md §6). This one is an actual tech flat-lay.
    image: 'https://images.unsplash.com/photo-1547381826-d0daa1bf63d8?w=1600&q=80&fit=crop',
    eyebrow: 'Trending Now',
    headline: 'Electronics',
    headlineAccent: '& gadgets.',
    subline: 'Find the latest tech from trusted vendors across Lagos.',
    cta: { label: 'Shop Electronics', href: `${ROUTES.categories}/electronics` },
    ctaSecondary: { label: 'View All', href: ROUTES.products },
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1600&q=80&fit=crop',
    eyebrow: 'Style Edit',
    headline: 'Fashion',
    headlineAccent: '& style.',
    subline: 'Discover clothing and accessories from top fashion vendors.',
    cta: { label: 'Shop Fashion', href: `${ROUTES.categories}/fashion-clothing` },
    ctaSecondary: { label: 'All Vendors', href: ROUTES.vendors },
  },
]

function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const { resolvedTheme } = useTheme()
  // `resolvedTheme` is undefined until next-themes mounts, specifically to avoid an SSR/CSR
  // mismatch — guessing light here (the site's actual default) means the very first paint is
  // already correct in the common case, with no visible flicker once it resolves.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === 'dark'

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
              <div
                className={cn(
                  'relative h-[480px] w-full overflow-hidden sm:h-[560px] lg:h-[640px]',
                  isDark ? 'bg-[#080d1c]' : 'bg-white',
                )}
              >
                {/* Background image */}
                <Image
                  src={slide.image}
                  alt={slide.headline}
                  fill
                  className="object-cover"
                  sizes="100vw"
                  priority={slide.id === 1}
                />
                {/* The scrim's colour follows theme explicitly (via `isDark`, not the `background`
                    token) rather than a `dark:` variant — this project doesn't wire one up, since
                    every other surface uses token-based classes (`bg-background` etc.) instead. A
                    plain `background`-token gradient was tried here once and looked near-opaque in
                    dark mode, hiding the photo — these two hand-picked scrims are tuned to actually
                    fade gently over a photo in both themes. */}
                <div
                  className={cn(
                    'absolute inset-0 bg-gradient-to-r',
                    isDark
                      ? 'from-[#080d1c] via-[#080d1c]/70 to-[#080d1c]/10'
                      : 'from-white via-white/75 to-white/20',
                  )}
                />

                {/* Slide content */}
                <div className="absolute inset-0 flex items-center">
                  <div className="mx-auto w-full max-w-8xl px-6 sm:px-8 lg:px-12">
                    <div className="max-w-xl space-y-6">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest',
                          isDark
                            ? 'border-blue-300/30 bg-blue-400/15 text-blue-200'
                            : 'border-primary/20 bg-primary/10 text-primary',
                        )}
                      >
                        {slide.eyebrow}
                      </span>
                      <h1
                        className={cn(
                          'font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl',
                          isDark ? 'text-white' : 'text-foreground',
                        )}
                      >
                        {slide.headline}
                        <br />
                        <span className="italic text-brand-accent">{slide.headlineAccent}</span>
                      </h1>
                      <p
                        className={cn(
                          'max-w-md text-base leading-relaxed sm:text-lg',
                          isDark ? 'text-white/70' : 'text-muted-foreground',
                        )}
                      >
                        {slide.subline}
                      </p>
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button size="lg" asChild className="shadow-card">
                          <Link href={slide.cta.href}>
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            {slide.cta.label}
                          </Link>
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          asChild
                          className={cn(
                            'backdrop-blur-sm',
                            isDark
                              ? 'border-white/30 bg-white/10 text-white hover:bg-white/20'
                              : 'border-black/10 bg-black/5 text-foreground hover:bg-black/10',
                          )}
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

        {/* Prev / Next arrows — float on the photo itself, so they follow the same isDark switch
            as the scrim above rather than the app's own background surface tokens. */}
        <button
          onClick={() => api?.scrollPrev()}
          className={cn(
            'absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
            isDark
              ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border border-black/10 bg-white/70 text-foreground hover:bg-white',
          )}
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => api?.scrollNext()}
          className={cn(
            'absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-colors',
            isDark
              ? 'border border-white/20 bg-white/10 text-white hover:bg-white/20'
              : 'border border-black/10 bg-white/70 text-foreground hover:bg-white',
          )}
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
                i === current
                  ? 'w-6 bg-primary'
                  : isDark
                    ? 'w-2 bg-white/25 hover:bg-white/40'
                    : 'w-2 bg-black/15 hover:bg-black/25',
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
    <div className="flex items-center gap-4">
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="h-px flex-1 bg-border" />
      <Link
        href={href}
        className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-4 rounded-xl border border-border p-6 sm:p-8">
            <div className="h-16 w-16 animate-pulse rounded-full bg-secondary" />
            <div className="h-3 w-16 animate-pulse rounded bg-secondary" />
          </div>
        ))}
      </div>
    )
  }

  if (!categories?.length) return null

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={ROUTES.category(cat.slug)}
          className="group flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-6 text-center transition-all duration-300 hover:shadow-card sm:p-8"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 transition-colors group-hover:bg-primary/10">
            <CategoryIcon name={cat.icon} className="h-7 w-7 text-primary" />
          </div>
          <span className="line-clamp-1 text-sm font-semibold text-foreground">{cat.name}</span>
        </Link>
      ))}
    </div>
  )
}

export function StoreHomePage() {
  const { data: featuredData, isLoading: loadingFeatured } = useProducts({ sort: 'popular', limit: 8 })
  const { data: newArrivalsData, isLoading: loadingNew } = useProducts({ sort: 'newest', limit: 8 })
  const { data: vendorsData, isLoading: loadingVendors, error: vendorsError } = useVendors({ limit: '4', status: 'active' })

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
        <section className="-mx-4 space-y-5 bg-secondary/40 px-4 py-12 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <SectionHeader title="Popular Right Now" href={ROUTES.products} />
          {loadingFeatured ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (
            <ProductGrid products={featuredData?.items} loading={false} cardBadgeLabel="Popular" />
          )}
        </section>

        {/* Top Vendors */}
        <section className="space-y-5">
          <SectionHeader title="Top Vendors" href={ROUTES.vendors} />
          {loadingVendors ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <VendorCardSkeleton key={i} />)}
            </div>
          ) : vendorsError ? (
            <EmptyState
              title="Could not load vendors"
              description="Something went wrong. Please try again."
            />
          ) : !vendorsData?.items?.length ? (
            <EmptyState
              title="No vendors yet"
              description="Check back soon — new vendors join AVDAN every week."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {vendorsData.items.map((vendor) => (
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

        {/* Trusted by — real featured vendors, not stock wordmarks */}
        {!loadingVendors && (vendorsData?.items?.length ?? 0) > 0 && (
          <section className="space-y-8 text-center">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
                Trusted by Local Vendors
              </h2>
              <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                Real vendors already selling on AVDAN — a growing marketplace built on speed and
                trust.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
              {vendorsData?.items?.map((vendor) => (
                <span
                  key={vendor.id}
                  className="text-lg font-bold tracking-tight text-muted-foreground/70 grayscale transition-colors hover:text-foreground hover:grayscale-0"
                >
                  {vendor.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Stats / CTA banner */}
        <section>
          <div className="relative flex flex-col items-start gap-10 overflow-hidden rounded-2xl bg-foreground px-8 py-12 text-background sm:px-12 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl space-y-4">
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                Fast delivery, total confidence.
              </h2>
              <p className="text-background/70">
                Thousands of orders move across Lagos every week — verified vendors, tracked
                riders, and escrow-protected payments from checkout to doorstep.
              </p>
              <div className="grid grid-cols-2 gap-8 pt-4">
                <div>
                  <p className="font-display text-2xl font-bold text-background">Verified</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-background/60">
                    Every Vendor
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-brand-accent">Live</p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-background/60">
                    Order Tracking
                  </p>
                </div>
              </div>
            </div>
            <Button
              size="lg"
              asChild
              className="shrink-0 bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90"
            >
              <Link href={ROUTES.vendors}>Explore Vendors</Link>
            </Button>
          </div>
        </section>

        {/* How AVDAN Works */}
        <section className="space-y-12 border-t border-border pt-12 text-center">
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              How AVDAN Works
            </h2>
            <p className="text-sm text-muted-foreground">
              From browse to doorstep in three simple steps.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: 'Discover',
                copy: 'Browse vendors and products curated for your neighborhood.',
              },
              {
                icon: ShoppingBag,
                title: 'Order',
                copy: 'Checkout securely with payments held in escrow until delivery.',
              },
              {
                icon: Truck,
                title: 'Receive',
                copy: 'Track your rider in real time from pickup to your door.',
              },
            ].map((step) => (
              <div key={step.title} className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="max-w-xs text-sm text-muted-foreground">{step.copy}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
