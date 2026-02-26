import { Tooltip } from "./Tooltip";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "icon";
  size?: "sm" | "md" | "lg" | "icon";
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  children,
  title,
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-bold rounded-lg transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const variants = {
    primary:
      "bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary-dark focus:ring-2 focus:ring-primary/20",
    secondary:
      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-sm",
    outline:
      "border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-white shadow-sm",
    ghost:
      "bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white",
    icon: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/50 dark:border-transparent transition-all shadow-sm", // Specialized style used in Header
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
    icon: "size-10 p-0", // For perfectly square icon buttons
  };

  const finalClassName = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`;

  const buttonElement = (
    <button className={finalClassName} {...props}>
      {children}
    </button>
  );

  if (title) {
    return (
      <Tooltip content={title} position="bottom">
        {buttonElement}
      </Tooltip>
    );
  }

  return buttonElement;
}
