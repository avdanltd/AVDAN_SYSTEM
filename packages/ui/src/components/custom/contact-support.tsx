import { Card, CardContent } from '../ui/card'

/** "Need help? Email …" card for the account/profile pages of every portal. */
export function ContactSupport({ email, audience }: { email: string; audience?: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-6">
        <h2 className="text-sm font-semibold text-foreground">Need help?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {audience ? `${audience}: write to ` : 'Write to '}
          <a href={`mailto:${email}`} className="font-medium text-primary hover:underline">
            {email}
          </a>{' '}
          and the AVDAN team will get back to you.
        </p>
      </CardContent>
    </Card>
  )
}
