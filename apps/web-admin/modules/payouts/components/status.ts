export const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Awaiting approval',
  PROCESSING: 'Sending to bank',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  FAILED: 'Transfer failed',
}

export const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'accent'> = {
  REQUESTED: 'accent',
  PROCESSING: 'secondary',
  PAID: 'default',
  REJECTED: 'destructive',
  FAILED: 'destructive',
}
