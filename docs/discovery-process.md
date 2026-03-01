# Proceso de Descubrimiento de Red (Venezuela)

Este documento detalla la estrategia y la arquitectura utilizada para identificar y monitorear la infraestructura de internet en Venezuela sin depender de APIs pagas (como Censys).

## 1. Estrategia de Muestreo BGP (BGP Sampling)

Dado que no tenemos una lista estática de todas las IPs de Venezuela, utilizamos un enfoque de **muestreo dinámico**:

1.  **Identificación de ASNs**: Cada proveedor (ISP) tiene uno o varios "Sistemas Autónomos" (ASN) que agrupan sus rangos de IP (prefijos).
2.  **Consulta de Prefijos**: Usamos la API gratuita de **RIPE Stat** (`stat.ripe.net`) para obtener todos los rangos (CIDR) anunciados por cada ASN.
3.  **Muestreo Inteligente**:
    - No escaneamos todas las IPs (sería billones).
    - Para cada rango (ej: `/24`), seleccionamos candidatos estratégicos y aleatorios.
    - **Densidad**: Ajustamos la cantidad de candidatos según el tamaño del bloque (más candidatos en bloques `/14` que en `/24`).
4.  **Verificación de Vida (TCP Check)**: Realizamos intentos de conexión en paralelo a una lista de **puertos comunes** que suelen estar abiertos en routers y nodos de red.

---

## 2. Proveedores y Nodos Críticos (ASNs)

Hemos validado y mapeado los principales proveedores de Venezuela:

| Proveedor      | ASN Principal | Tipo de Red            | Notas                                      |
| :------------- | :------------ | :--------------------- | :----------------------------------------- |
| **CANTV**      | AS8048        | Estatal / ADSL / Fibra | El más grande del país.                    |
| **Inter**      | AS21826       | HFC / Fibra            | Cobertura nacional masiva.                 |
| **Digitel**    | AS27717       | Móvil 4G/LTE           | Muy fragmentado en muchos rangos pequeños. |
| **Movistar**   | AS6306        | Móvil / Corporativo    | Bloques de red gigantes (/14, /15).        |
| **Net Uno**    | AS11562       | HFC / Fibra            | Presencia importante en Caracas/Zulia.     |
| **Airtek**     | AS61461       | WISP / Fibra           | Dominante en el Occidente (Zulia).         |
| **Thundernet** | AS272809      | Fibra                  | Crecimiento rápido en los llanos y centro. |
| **VNET**       | AS264639      | Fibra                  | Corporativo y Residencial Premium.         |

---

## 3. Puertos de Detección (Radar)

Escaneamos los siguientes servicios para confirmar que una IP pertenece a un equipo de red activo:

- **Administración**: `80`, `443`, `8080`, `8443`
- **Gestión Remota**: `22` (SSH), `23` (Telnet), `3389` (RDP)
- **Equipos de Red (Mikrotik/Ubiquiti)**: `8291` (Winbox), `8728` (API), `2000` (Bandwidth Test)
- **Servicios de ISP**: `7547` (TR-069), `5060` (SIP/VoIP), `53` (DNS), `161` (SNMP)

---

## 4. Arquitectura del Sistema

El sistema es 100% distribuido y persistente:

1.  **Paralelismo**: `scripts/run-all-discovery.ts` lanza workers independientes por cada proveedor.
2.  **Persistencia (Supabase)**: - `scanned_prefixes`: Registra qué rangos ya fueron analizados para no repetir trabajo. - `monitoring_targets`: El inventario final de IPs con su geolocalización verificada. 3._ **Geolocalización**: Cada IP "viva" se verifica contra la API de `ip-api.com`.
    _ **Filtro país**: Solo se guardan IPs donde `countryCode === 'VE'`. \* **Normalización**: Se normaliza el nombre del estado (ej: "zulia", "miranda").

---

## 5. Modos de Operación y Comandos

- **Escanear todo**: `npx tsx scripts/run-all-discovery.ts`
- **Modo Rudo (Exhaustivo)**: `npx tsx scripts/run-all-discovery.ts --aggressive`
  - _Nota: En este modo, el script prueba las 254 IPs de cada rango /24. Es mucho más lento pero mucho más efectivo._
- **Bucle Continuo**: `npx tsx scripts/run-all-discovery.ts --loop`
- **Enriquecer IPs existentes**: `npx tsx scripts/enrich-targets.ts`
  - _Nota: Este comando procesa las IPs ya guardadas en la DB para extraer títulos web y certificados SSL sin ralentizar el descubrimiento._
- **Limpiar progreso (Reset)**: `TRUNCATE scanned_prefixes;` (en Supabase SQL)
