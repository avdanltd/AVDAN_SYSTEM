'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  Bell,
  Menu,
  Search,
  ChevronDown,
  Home,
  Package,
  Grid3x3,
  User,
  X,
} from 'lucide-react'

import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetContent,
  SheetTrigger,
  Input,
  cn,
  CategoryIcon,
  Logo,
} from '@avdan/ui'
import { ROUTES } from '@/config/routes'
import { useSession } from '@/modules/auth/hooks/use-session'
import { useLogout } from '@/modules/auth/hooks/use-logout'
import { useCartStore } from '@/modules/cart/store/cart.store'
import { CartDrawer } from '@/modules/cart/components/cart-drawer'
import { useCategories } from '@/modules/categories/hooks/use-categories'

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

interface SearchOverlayProps {
  onClose: () => void
}

function SearchOverlay({ onClose }: SearchOverlayProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'products' | 'vendors'>('products')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`${ROUTES.search}?q=${encodeURIComponent(query.trim())}&type=${searchType}`)
    onClose()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-1 items-center gap-3"
    >
      <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="What are you looking for?"
        className="h-10 flex-1 border-0 bg-transparent px-0 text-base shadow-none ring-0 focus-visible:ring-0"
      />
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Search for:</span>
        <button
          type="button"
          onClick={() => setSearchType('products')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            searchType === 'products'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          Products
        </button>
        <button
          type="button"
          onClick={() => setSearchType('vendors')}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            searchType === 'vendors'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground hover:text-foreground',
          )}
        >
          Vendors
        </button>
      </div>
      {query && (
        <Button type="submit" size="sm" className="shrink-0">
          Go
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close search"
        className="shrink-0"
      >
        <X className="h-5 w-5" />
      </Button>
    </form>
  )
}

function CategoryMegaMenu() {
  const { data: categories } = useCategories()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        Categories
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && categories && categories.length > 0 && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-120 -translate-x-1/2 rounded-xl border border-border bg-background p-3 shadow-lg">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shop by category
          </p>
          <div className="grid grid-cols-2 gap-1">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={ROUTES.category(cat.slug)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {cat.icon && <CategoryIcon name={cat.icon} className="h-4 w-4 shrink-0" />}
                <span className="line-clamp-1">{cat.name}</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <Link
              href={ROUTES.categories}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              View all categories →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

interface MobileNavProps {
  isAuthenticated: boolean
  user: { name: string | null; email: string | null; phone: string | null } | null
  onNav: () => void
  onLogout: () => void
  isPending: boolean
}

function MobileNav({ isAuthenticated, user, onNav, onLogout, isPending }: MobileNavProps) {
  const { data: categories } = useCategories()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'products' | 'vendors'>('products')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`${ROUTES.search}?q=${encodeURIComponent(query.trim())}&type=${searchType}`)
    onNav()
  }

  const linkClass =
    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href={ROUTES.home} onClick={onNav}>
          <Logo size="sm" />
        </Link>
      </div>

      {/* Search with type toggle */}
      <div className="border-b border-border px-4 py-3">
        <form onSubmit={handleSearch}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products or vendors…"
              className="h-10 pl-10"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Search for:</span>
            <button
              type="button"
              onClick={() => setSearchType('products')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                searchType === 'products'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              Products
            </button>
            <button
              type="button"
              onClick={() => setSearchType('vendors')}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                searchType === 'vendors'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              Vendors
            </button>
          </div>
        </form>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        <Link href={ROUTES.home} onClick={onNav} className={linkClass}>
          <Home className="h-4 w-4" /> Home
        </Link>
        <Link href={ROUTES.products} onClick={onNav} className={linkClass}>
          <Package className="h-4 w-4" /> All Products
        </Link>
        <Link href={ROUTES.categories} onClick={onNav} className={linkClass}>
          <Grid3x3 className="h-4 w-4" /> Categories
        </Link>
        <Link href={ROUTES.vendors} onClick={onNav} className={linkClass}>
          <span className="h-4 w-4 text-center text-xs">🏪</span> Vendors
        </Link>

        {categories && categories.length > 0 && (
          <div className="pt-2">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Shop by category
            </p>
            {categories.slice(0, 8).map((cat) => (
              <Link
                key={cat.id}
                href={ROUTES.category(cat.slug)}
                onClick={onNav}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {cat.icon && <CategoryIcon name={cat.icon} className="h-4 w-4 shrink-0" />}
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {isAuthenticated && (
          <div className="pt-2 border-t border-border mt-2">
            <Link href={ROUTES.orders} onClick={onNav} className={linkClass}>
              <Package className="h-4 w-4" /> My Orders
            </Link>
            <Link href={ROUTES.notifications} onClick={onNav} className={linkClass}>
              <Bell className="h-4 w-4" /> Notifications
            </Link>
            <Link href={ROUTES.profile} onClick={onNav} className={linkClass}>
              <User className="h-4 w-4" /> Profile
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-border px-4 py-4">
        {isAuthenticated ? (
          <>
            <div className="mb-2 flex items-center gap-3 rounded-md px-3 py-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {getUserInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{user?.name ?? '—'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.email ?? user?.phone ?? ''}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              disabled={isPending}
              className="w-full rounded-md px-3 py-2.5 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
            >
              {isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <Button className="w-full" asChild>
              <Link href={ROUTES.login} onClick={onNav}>
                Sign in
              </Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={ROUTES.register} onClick={onNav}>
                Create account
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function Navbar() {
  const { user, isAuthenticated } = useSession()
  const { mutate: logout, isPending } = useLogout()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const itemCount = useCartStore((s) => s.itemCount())

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative mx-auto flex h-16 max-w-8xl items-center px-4 sm:px-6 lg:px-8">

          {/* ── Left: hamburger (mobile) + logo ── */}
          <div className="flex shrink-0 items-center gap-1.5">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <MobileNav
                  isAuthenticated={isAuthenticated}
                  user={user}
                  onNav={() => setMobileOpen(false)}
                  onLogout={() => {
                    logout()
                    setMobileOpen(false)
                  }}
                  isPending={isPending}
                />
              </SheetContent>
            </Sheet>

            <Link href={ROUTES.home} className="shrink-0">
              <Logo size="sm" className="lg:h-10" />
            </Link>
          </div>

          {/* ── Center: desktop nav (absolute so it's truly centered) ── */}
          {!searchOpen && (
            <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex">
              <Link
                href={ROUTES.products}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Products
              </Link>
              <CategoryMegaMenu />
              <Link
                href={ROUTES.vendors}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                Vendors
              </Link>
            </nav>
          )}

          {/* ── Desktop search overlay (full width, replaces center content) ── */}
          {searchOpen && (
            <div className="absolute inset-0 z-10 hidden items-center gap-3 border-b border-border bg-background px-4 lg:flex sm:px-6 lg:px-8">
              <SearchOverlay onClose={closeSearch} />
            </div>
          )}

          {/* ── Right: actions ── */}
          <div className="ml-auto flex items-center gap-1">
            {/* Desktop search icon */}
            {!searchOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:inline-flex"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </Button>
            )}

            {/* Mobile search icon */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
            >
              {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={`Cart${itemCount > 0 ? ` (${itemCount} items)` : ''}`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center',
                    'rounded-full bg-primary text-[10px] font-bold text-primary-foreground',
                  )}
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Button>

            {isAuthenticated ? (
              <>
                <Link href={ROUTES.notifications}>
                  <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                  </Button>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-9 w-9 rounded-full p-0"
                      aria-label="Account menu"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getUserInitials(user?.name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{user?.name ?? '—'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.email ?? user?.phone ?? ''}
                      </p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={ROUTES.profile}>Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={ROUTES.orders}>My Orders</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      disabled={isPending}
                      className="text-destructive focus:text-destructive"
                    >
                      {isPending ? 'Signing out…' : 'Sign out'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={ROUTES.login}>Sign in</Link>
                </Button>
                <Button size="sm" className="hidden sm:inline-flex" asChild>
                  <Link href={ROUTES.register}>Get started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile collapsible search bar ── */}
        {mobileSearchOpen && (
          <MobileSearchBar onClose={() => setMobileSearchOpen(false)} />
        )}
      </header>

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </>
  )
}

function MobileSearchBar({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'products' | 'vendors'>('products')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    router.push(`${ROUTES.search}?q=${encodeURIComponent(query.trim())}&type=${searchType}`)
    onClose()
  }

  return (
    <div className="border-t border-border px-4 py-3 lg:hidden">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products or vendors…"
            className="h-10 pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Search for:</span>
          <button
            type="button"
            onClick={() => setSearchType('products')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              searchType === 'products'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            Products
          </button>
          <button
            type="button"
            onClick={() => setSearchType('vendors')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              searchType === 'vendors'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground',
            )}
          >
            Vendors
          </button>
          {query && (
            <Button type="submit" size="sm" className="ml-auto">
              Search
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
