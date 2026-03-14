# Roadmap - Vzla Blackout Tracker 🇻🇪⚡

Aquí tienes las funcionalidades y mejoras pendientes para convertir esta herramienta en un sistema de monitoreo profesional.

## 1. Alertas y Notificaciones (Próximo Objetivo)

- [ ] **Integración con Telegram/Discord**: Crear un bot que envíe alertas automáticas cuando se detecte una falla masiva en un estado (ej: "⚠️ Falla masiva detectada en Zulia - 40% de nodos offline").
- [ ] **Sistema de Suscripción**: Permitir que los usuarios se suscriban a alertas de estados específicos.

## 2. Refinamiento de Datos y UX

- [ ] **Historial de Incidentes**: Crear una vista que liste los últimos apagones detectados por zona con su duración estimada.
- [ ] **Exportación de Reportes**: Permitir descargar datos históricos en CSV/JSON para análisis externo.

---

> [!NOTE]
> **Documentación de Descubrimiento**: Toda la información técnica sobre cómo mapeamos la red se ha consolidado en [docs/aggressive-discovery-commands.md](file:///Users/alejandro.berbin/Projects/Others/blackout-tracker/docs/aggressive-discovery-commands.md).

> [!TIP]
> **Recomendación inmediata**: Podríamos empezar con el **Bot de Telegram**, ya que la base de datos ya tiene suficiente información para empezar a disparar alertas reales basado en los checks actuales.
