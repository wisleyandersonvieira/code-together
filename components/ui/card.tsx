import * as React from "react"
import { Slot } from "@radix-ui/react-slot"

import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Renderiza o filho no lugar da <div>, mantendo as classes do Card. Serve
   * para um card inteiro ser um <button> de verdade — com div + role="button"
   * o foco de teclado e o Enter dependem de handler manual.
   */
  asChild?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "div"
    return (
      <Comp
        ref={ref}
        className={cn(
          "rounded-xl border border-border bg-card text-card-foreground",
          className,
        )}
        {...props}
      />
    )
  },
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

/**
 * `page` keeps the historical look (large, high-contrast) used by form and
 * report screens. `section` is the quieter label used when the card title must
 * not compete with the data it introduces.
 */
const cardTitleSizes = {
  page: "text-2xl font-semibold leading-none tracking-tight text-card-foreground",
  section:
    "text-sm font-semibold uppercase leading-none tracking-wide text-muted-foreground",
} as const

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  size?: keyof typeof cardTitleSizes
}

const CardTitle = React.forwardRef<HTMLParagraphElement, CardTitleProps>(
  ({ className, size = "page", ...props }, ref) => (
    <h3 ref={ref} className={cn(cardTitleSizes[size], className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
