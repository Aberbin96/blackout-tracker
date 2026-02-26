"use client";

import { Share2, Twitter, MessageCircle } from "lucide-react";
import { useState } from "react";
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
        className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black px-4 py-2 rounded-md font-medium text-sm transition-opacity hover:opacity-90"
      >
        <Share2 className="w-4 h-4" />
        {t("button")}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg z-50 p-2">
          <button
            onClick={() => handleShare("twitter")}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            <Twitter className="w-4 h-4 text-blue-400" />
            <span>{t("twitter")}</span>
          </button>
          <button
            onClick={() => handleShare("whatsapp")}
            className="flex items-center gap-3 w-full px-4 py-2 text-sm text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-green-500" />
            <span>{t("whatsapp")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
