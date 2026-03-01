"use server";

import axios from "axios";

/**
 * Service to handle Telegram notifications for critical events.
 */
export class TelegramService {
  private static BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  private static CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  /**
   * Sends a formatted alert about a confirmed regional blackout.
   */
  static async sendBlackoutAlert(
    state: string,
    total: number,
    offline: number,
  ) {
    if (!this.BOT_TOKEN || !this.CHAT_ID) {
      console.warn("Telegram credentials not configured. Skipping alert.");
      return;
    }

    const offlinePercent = Math.round((offline / total) * 100);
    const timestamp = new Date().toLocaleString("es-VE", {
      timeZone: "America/Caracas",
    });

    const message = `
⚠️ <b>APAGÓN CONFIRMADO: ${state.toUpperCase()}</b> ⚠️

Se ha detectado una falla masiva en el estado <b>${state}</b>.

📊 <b>Impacto:</b> ${offlinePercent}% de nodos caídos
🔌 <b>Detalle:</b> ${offline} de ${total} sensores offline
⏰ <b>Inició:</b> ${timestamp}

🌐 Ver mapa en vivo: [Blackout Tracker](https://blackout-tracker.vercel.app/)

#Venezuela #SinLuz #Apagon #${state}
    `.trim();

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`,
        {
          chat_id: this.CHAT_ID,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        },
      );
      console.log(`Telegram alert sent for ${state}`);
    } catch (error: any) {
      console.error(
        "Error sending Telegram alert:",
        error.response?.data || error.message,
      );
    }
  }

  /**
   * Sends a notification when a blackout is resolved.
   */
  static async sendBlackoutResolved(state: string) {
    if (!this.BOT_TOKEN || !this.CHAT_ID) return;

    const timestamp = new Date().toLocaleString("es-VE", {
      timeZone: "America/Caracas",
    });
    const message = `
✅ <b>FALLA RESUELTA: ${state.toUpperCase()}</b> ✅

La conectividad en el estado <b>${state}</b> se ha normalizado. Los servicios están volviendo progresivamente a la normalidad.

⏰ <b>Resuelto:</b> ${timestamp}

#Venezuela #LuzRestituida #${state}
    `.trim();

    try {
      await axios.post(
        `https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`,
        {
          chat_id: this.CHAT_ID,
          text: message,
          parse_mode: "HTML",
        },
      );
    } catch (error) {
      console.error("Error sending Telegram resolution:", error);
    }
  }
}
