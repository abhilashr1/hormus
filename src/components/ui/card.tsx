import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border border-[var(--border)] bg-[var(--panel)] shadow-none",
        className,
      )}
      {...props}
    />
  );
}
