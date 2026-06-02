'use client'

import { Toaster } from 'sonner'

function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'font-sans text-sm',
          title: 'font-medium text-[--color-text-primary]',
          description: 'text-[--color-text-secondary]',
          success: 'border-l-4 border-[--color-success]',
          error: 'border-l-4 border-[--color-error]',
          warning: 'border-l-4 border-[--color-warning]',
          info: 'border-l-4 border-[--color-info]',
        },
      }}
    />
  )
}

export { ToastProvider }
