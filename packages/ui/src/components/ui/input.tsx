import * as React from "react"

import { cn } from "../../lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // shadow-sm (Tailwind's built-in low-opacity black shadow, not a custom token) gives
          // the field a soft lift off the page instead of sitting perfectly flat — subtle enough
          // to stay correct in dark mode too (a near-invisible black shadow, never a hardcoded
          // light-mode-only color). rounded-md resolves to the bumped --radius-md token.
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm ring-offset-background transition-shadow file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
