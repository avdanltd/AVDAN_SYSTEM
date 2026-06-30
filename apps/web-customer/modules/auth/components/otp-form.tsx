'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from '@avdan/ui'

import { ROUTES } from '@/config/routes'
import { authService } from '../services/auth.service'

interface OtpFormProps {
  userId: string
  email?: string
  onBack?: () => void
}

function obfuscateEmail(email?: string): string {
  if (!email) return 'your email'
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const obscuredLocal = local.length > 2
    ? `${local[0]}***${local[local.length - 1]}`
    : `${local[0]}***`
  const domainParts = domain.split('.')
  const obscuredDomain = domainParts.length > 1
    ? `${domainParts[0][0]}***.${domainParts[domainParts.length - 1]}`
    : domain
  return `${obscuredLocal}@${obscuredDomain}`
}

export function OtpForm({ userId, email, onBack }: OtpFormProps) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const router = useRouter()

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [countdown])

  const verifyMutation = useMutation({
    mutationFn: () => authService.verifyOtp({ user_id: userId, otp: digits.join('') }),
    onSuccess: () => {
      toast.success('Account verified! Please sign in.')
      router.push(ROUTES.login)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const resendMutation = useMutation({
    mutationFn: () => authService.resendOtp(userId),
    onSuccess: () => {
      setCountdown(60)
      toast.success('A new verification code has been sent!')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i] ?? ''
    setDigits(next)
    inputRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  const isComplete = digits.every((d) => d !== '')

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Enter the 6-digit code sent to <span className="font-semibold text-foreground">{obfuscateEmail(email)}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={handlePaste}
                className="h-12 w-10 rounded-md border border-input bg-background text-center text-xl font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </div>

          <Button
            className="w-full"
            disabled={!isComplete || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            {verifyMutation.isPending ? 'Verifying…' : 'Verify OTP'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {countdown > 0 ? (
              <>Resend code in {countdown}s</>
            ) : (
              <button
                type="button"
                className="text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending}
              >
                {resendMutation.isPending ? 'Sending…' : 'Resend OTP'}
              </button>
            )}
          </p>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to registration
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
