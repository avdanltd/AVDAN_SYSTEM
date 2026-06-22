'use client'

import { Component, ReactNode } from 'react'
import { Button } from '@avdan/ui'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-semibold">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{this.state.message}</p>
          <Button onClick={() => this.setState({ hasError: false, message: '' })}>Try again</Button>
        </div>
      )
    }
    return this.props.children
  }
}
