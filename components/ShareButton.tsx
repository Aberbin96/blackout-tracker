"use client";

import { useState } from "react";
import { Icon } from "./atoms/Icon";
import { useTranslations } from "next-intl";

export function ShareButton() {
  const t = useTranslations("Share");
  const [isOpen, setIsOpen] = useState(false);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = t("text");

  const handleShare = (platform: "twitter" | "whatsapp") => {
    let url = "";
    if (platform === "twitter") {
      url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    } else if (platform === "whatsapp") {
      url = `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
    }
    window.open(url, "_blank");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-xl h-10 w-10 glass-card bg-secondary/5 text-secondary dark:text-accent hover:bg-secondary/10 transition-all duration-200"
      >
        <Icon name="share" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-xl shadow-lg z-50 p-2 overflow-hidden">
          <button
            onClick={() => handleShare("twitter")}
            className="flex items-center gap-3 w-full px-4 py-2 mt-1 text-sm font-bold text-slate-700 dark:text-slate-300 left hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/-w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="text-foreground dark:text-white"
              viewBox="0 0 16 16"
            >
              <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
            </svg>
            <span>{t("button")}</span>
          </button>
          <button
            onClick={() => handleShare("whatsapp")}
            className="flex items-center gap-3 w-full px-4 py-2 mt-1 text-sm font-bold text-slate-700 dark:text-slate-300 text-left hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/-w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              className="text-[#25D366]"
              viewBox="0 0 16 16"
            >
              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z" />
            </svg>
            <span>{t("whatsapp")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
