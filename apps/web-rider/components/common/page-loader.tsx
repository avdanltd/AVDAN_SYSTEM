import { Spinner } from '@avdan/ui'

export function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
