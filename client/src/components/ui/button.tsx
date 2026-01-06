import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform-gpu",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-purple-500 via-purple-600 to-purple-800 text-white shadow-[0_6px_0_0_#581c87,0_8px_15px_rgba(88,28,135,0.5)] hover:shadow-[0_4px_0_0_#581c87,0_6px_10px_rgba(88,28,135,0.6)] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#581c87] active:translate-y-[6px] border-t border-purple-400/50",
        destructive:
          "bg-gradient-to-b from-red-500 via-red-600 to-red-800 text-white shadow-[0_6px_0_0_#7f1d1d,0_8px_15px_rgba(127,29,29,0.5)] hover:shadow-[0_4px_0_0_#7f1d1d,0_6px_10px_rgba(127,29,29,0.6)] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#7f1d1d] active:translate-y-[6px] border-t border-red-400/50",
        outline:
          "border-2 border-purple-500 bg-black/40 text-purple-100 shadow-[0_0_15px_rgba(147,51,234,0.3),inset_0_0_15px_rgba(147,51,234,0.1)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5),inset_0_0_20px_rgba(147,51,234,0.2)] hover:border-purple-400 hover:scale-105",
        secondary:
          "bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900 text-white shadow-[0_6px_0_0_#0f172a,0_8px_15px_rgba(15,23,42,0.5)] hover:shadow-[0_4px_0_0_#0f172a,0_6px_10px_rgba(15,23,42,0.6)] hover:translate-y-[2px] active:shadow-[0_0px_0_0_#0f172a] active:translate-y-[6px] border-t border-slate-500/50",
        ghost: "hover:bg-purple-500/20 hover:text-purple-100 text-purple-200/70 hover:shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:scale-105",
        link: "text-purple-400 underline-offset-4 hover:underline hover:text-purple-300",
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
