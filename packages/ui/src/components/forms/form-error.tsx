import * as React from 'react'

interface FormErrorProps {
  message?: string
}

function FormError({ message }: FormErrorProps) {
  if (!message) return null
  return <p className="text-xs text-[--color-error]">{message}</p>
}

export { FormError }
