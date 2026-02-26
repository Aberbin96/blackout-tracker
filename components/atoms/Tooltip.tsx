"use client";

import React, { useState } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 -mt-1 border-t-slate-800 dark:border-t-slate-700",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-b-slate-800 dark:border-b-slate-700",
    left: "left-full top-1/2 -translate-y-1/2 -ml-1 border-l-slate-800 dark:border-l-slate-700",
    right:
      "right-full top-1/2 -translate-y-1/2 -mr-1 border-r-slate-800 dark:border-r-slate-700",
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className={`absolute z-[100] ${positionClasses[position]}`}>
          <div
            className={`relative px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 rounded-lg shadow-xl backdrop-blur-md opacity-0 animate-tooltip-in whitespace-nowrap`}
          >
            {content}
            <div
              className={`absolute border-4 border-transparent ${arrowClasses[position]}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
