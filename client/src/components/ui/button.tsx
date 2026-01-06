import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-transparent border-2 border-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)] hover:bg-purple-600 hover:shadow-[0_0_12px_rgba(168,85,247,0.6)] active:bg-purple-700 active:scale-95",
        destructive:
          "bg-transparent border-2 border-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)] hover:bg-red-600 hover:shadow-[0_0_12px_rgba(239,68,68,0.6)] active:bg-red-700 active:scale-95",
        outline:
          "border-2 border-slate-500 bg-transparent text-white shadow-[0_0_6px_rgba(148,163,184,0.3)] hover:bg-slate-700/50 hover:shadow-[0_0_10px_rgba(148,163,184,0.4)]",
        secondary:
          "bg-transparent border-2 border-slate-400 text-white shadow-[0_0_6px_rgba(148,163,184,0.3)] hover:bg-slate-700 hover:shadow-[0_0_10px_rgba(148,163,184,0.4)]",
        ghost: "hover:bg-slate-700/50 text-slate-300",
        link: "text-purple-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-xl px-3 text-xs",
        lg: "h-10 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
