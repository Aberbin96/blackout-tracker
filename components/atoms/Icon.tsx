import React from "react";

interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  filled?: boolean;
}

export function Icon({
  name,
  filled = false,
  className = "",
  ...props
}: IconProps) {
  const baseClass = filled
    ? "material-symbols-rounded"
    : "material-symbols-outlined";
  return (
    <span className={`${baseClass} ${className}`} {...props}>
      {name}
    </span>
  );
}
