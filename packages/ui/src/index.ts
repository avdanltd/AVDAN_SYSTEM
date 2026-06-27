// ─── Shadcn primitives (from src/components/ui/) ─────────────────────────────
export { Button, buttonVariants } from './components/ui/button'
export { Input } from './components/ui/input'
export { Label } from './components/ui/label'
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './components/ui/card'
export { Badge, badgeVariants } from './components/ui/badge'
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog'
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu'
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from './components/ui/form'
export { Separator } from './components/ui/separator'
export { Skeleton } from './components/ui/skeleton'
export { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar'
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from './components/ui/sheet'
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
export { Textarea } from './components/ui/textarea'
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
export { Switch } from './components/ui/switch'
export { Progress } from './components/ui/progress'
export {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from './components/ui/carousel'

// ─── Custom components (built on top of Shadcn) ───────────────────────────────
export { OrderStatusBadge, UserStatusBadge } from './components/custom/status-badge'
export { StatsCard } from './components/custom/stats-card'
export { ConfirmDialog } from './components/custom/confirm-dialog'
export { DataTable } from './components/custom/data-table'
export type { Column } from './components/custom/data-table'
export { PageLoader } from './components/custom/page-loader'
export { CategoryIcon } from './components/custom/category-icon'
export { Logo } from './components/custom/logo'
export { Spinner } from './components/primitives/spinner'
export { EmptyState } from './components/custom/empty-state'

// ─── Feedback ─────────────────────────────────────────────────────────────────
export { ToastProvider } from './components/feedback/toast-provider'
export { toast } from './components/feedback/toast'

// ─── Utils ────────────────────────────────────────────────────────────────────
export { cn } from './lib/utils'
