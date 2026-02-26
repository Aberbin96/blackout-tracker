import React from "react";

export type BadgeVariant = "success" | "warning" | "error" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  text: string;
  showDot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, { color: string; dot: string }> = {
  success: {
    color:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  warning: {
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  error: {
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  neutral: {
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-500",
  },
};

export function Badge({
  variant = "neutral",
  text,
  showDot = true,
  className = "",
}: BadgeProps) {
  const config = variants[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${config.color} ${className}`}
    >
      {showDot && (
        <span className={`size-1.5 rounded-full ${config.dot}`}></span>
      )}
      {text}
    </span>
  );
}
