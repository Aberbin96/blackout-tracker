# Próximos Pasos - Vzla Blackout Tracker 🇻🇪⚡

Mientras el proceso de descubrimiento (`run-all-discovery`) llena la base de datos con IPs venezolanas, aquí tienes una lista de las funcionalidades y mejoras que podemos implementar para convertir esto en una herramienta de monitoreo profesional.

## 1. Visualización Avanzada (Dashboard)

- [x] **Limpieza de Datos**: Se han normalizado todos los estados en la base de datos (quitando acentos y duplicados).
- [x] **API de Monitoreo**: Implementado el endpoint `/api/check` listo para ser llamado por GitHub Actions.
- [x] **Mapa Interactivo**: Mapa de calor (Leaflet) que muestra la densidad de nodos activos y zonas con fallas.
- [x] **Filtros Dinámicos**: Implementado el filtrado global por Estado e ISP.
- [x] **Gráficas con Recharts**: Visualización histórica de disponibilidad por día y hora.

## 2. Sistema de Monitoreo Activo (Backend)

- [x] **Detección de Latencia**: Guardar el tiempo de respuesta en cada check para identificar no solo apagones, sino también degradación del servicio (internet lento).
- [x] **Lógica de "Apagón Confirmado"**: Implementar un algoritmo que confirme un apagón solo si N cantidad de nodos en una misma zona están caídos simultáneamente.

## 3. Alertas y Notificaciones

- [ ] **Integración con Telegram/Discord**: Crear un bot que envíe alertas automáticas cuando se detecte una falla masiva en un estado (ej: "⚠️ Falla masiva detectada en Zulia - 40% de nodos offline").
- [ ] **Sistema de Suscripción**: Permitir que los usuarios se suscriban a alertas de estados específicos.

## 4. Enriquecimiento de Datos

- [x] **Identificación de Infraestructura**: Usar los títulos web y certificados SSL para clasificar IPs (ej: "Nodo Cantv", "Router Mikrotik de Empresa", "Página de Gobierno").
- [x] **Detección de Móvil vs Residencial**: Refinar la métrica de `is_mobile` para separar el estado de la red celular de la red fija.

## 5. Optimización y Seguridad

- [x] **Caché de Geocalización**: Evitar llamadas redundantes a `ip-api` para IPs ya conocidas.
- [x] **Optimización de Descubrimiento**: Incrementar concurrencia y paralelismo para mapear la red 5x más rápido.

---

> [!TIP]
> **Recomendación inmediata**: Podríamos empezar con el **Mapa Interactivo** o con el **Worker de Verificación**, que es lo que realmente empezará a "mover" las gráficas del dashboard con datos vivos.
