import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default:
    "bg-[var(--accent)] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] hover:bg-[var(--accent-strong)]",
  secondary:
    "bg-[var(--panel-elevated)] text-[var(--foreground)] hover:bg-[rgba(255,255,255,0.04)] shadow-[0_0_0_1px_var(--border)_inset]",
  ghost: "text-[var(--muted-foreground)] hover:bg-[var(--panel-elevated)] hover:text-[var(--foreground)]",
  outline:
    "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--panel-elevated)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: "default" | "sm" | "icon";
}

export function Button({ className, variant = "default", size = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        size === "default" && "h-10 px-4 text-sm",
        size === "sm" && "h-8 px-3 text-xs",
        size === "icon" && "h-8 w-8",
        className,
      )}
      {...props}
    />
  );
}
