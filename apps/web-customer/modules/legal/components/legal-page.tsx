import type { ReactNode } from 'react'

export interface LegalSection {
  heading: string
  body: ReactNode
}

/** Plain, readable layout shared by the privacy policy, terms and account-deletion pages. */
export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string
  updated: string
  intro: ReactNode
  sections: LegalSection[]
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-10 text-sm leading-relaxed text-muted-foreground">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
        <p className="text-xs">Last updated {updated}</p>
        <div className="text-base text-foreground">{intro}</div>
      </header>
      {sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{s.heading}</h2>
          <div className="space-y-2 [&_a]:text-primary [&_a]:underline [&_li]:ml-5 [&_li]:list-disc">{s.body}</div>
        </section>
      ))}
    </article>
  )
}
