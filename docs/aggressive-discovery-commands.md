# Comandos y Estrategia de Descubrimiento (Discovery Deep Dive)

Este documento detalla la estrategia, arquitectura y comandos avanzados utilizados para identificar y monitorear la infraestructura de internet en Venezuela sin depender de APIs pagas (como Censys).

## 1. Arquitectura y Estrategia de Muestreo (BGP Sampling)

Dado que no existe una lista estática de todas las IPs de Venezuela, utilizamos un enfoque de **muestreo dinámico**:

1.  **Identificación de ASNs**: Cada proveedor (ISP) tiene uno o varios "Sistemas Autónomos" (ASN) que agrupan sus rangos de IP (prefijos).
2.  **Consulta de Prefijos**: Usamos la API gratuita de **RIPE Stat** para obtener todos los rangos (CIDR) anunciados por cada ASN.
3.  **Muestreo Inteligente**:
    - **Escaneo Normal**: Para bloques /24 escanea solo 10 IPs; para bloques grandes escanea muestras aleatorias.
    - **Modo Agresivo**: Para bloques `<= /22` escanea el **100% de las IPs**.
4.  **Verificación de Vida (TCP Check)**: Realizamos intentos de conexión en paralelo a una lista de **puertos comunes** (Ver sección 4).

---

## 2. Modos de Operación y Comandos

### Proceso Masivo (Todos los Proveedores)

Si necesitas recorrer **TODOS** los proveedores activos a nivel nacional:

```bash
# Escaneo de TODOS los proveedores configurados (Modo Rudo)
npx tsx scripts/run-all-discovery.ts --aggressive
```

- **Bucle Continuo**: `npx tsx scripts/run-all-discovery.ts --loop`
- **Modo Agresivo**: Este modo desactiva gran parte del límite de muestreo aleatorio. Revisará bloques de red enteros (/22 e inferiores) secuencialmente al 100%.

### Escaneo por Proveedor Específico

Si quieres apuntar el escaneo a un proveedor específico:

```bash
# Ejemplo: CANTV (El gigante estatal)
npx tsx scripts/discover-ips.ts --provider="CANTV" --aggressive

# Multi-proveedor
npx tsx scripts/discover-ips.ts --provider="Airtek" --provider="Thundernet" --aggressive
```

**Proveedores Disponibles**:
`CANTV`, `Inter`, `Digitel`, `Movistar`, `Net Uno`, `Airtek`, `Thundernet`, `VNET`, `Fibex`, `Gold Data`, `Gandalf`.

---

## 3. Estrategias de Escaneo (Deep Logic)

La lógica de densidad de escaneo reside en la función `getCandidates` de `scripts/discover-ips.ts`.

| Tamaño del Bloque (CIDR)      | Estrategia Normal | Estrategia Agresiva (--aggressive) |
| ----------------------------- | ----------------- | ---------------------------------- |
| **<= /22** (hasta 1,024 IPs)  | Sampling Ligero   | **Full Scan (100% IP por IP)**     |
| **/16 a /21**                 | Sampling Ligero   | Denser Sampling (~720 IPs)         |
| **< /16** (Grandes Backbones) | Random Sampling   | Massive Sampling (400 muestras)    |

> [!TIP]
> **Filtrar Bloques Densos**: Añade `--full-only` para que el script solo mire las subredes que Censys ha reportado como "casi llenas" (>80% activas), ignorando bloques vacíos.

---

## 4. Puertos de Detección (Radar)

Escaneamos los siguientes servicios para confirmar que una IP pertenece a un equipo activo:

- **Web / Admin**: `80`, `443`, `8080`, `8443`
- **Gestión**: `22` (SSH), `23` (Telnet), `3389` (RDP)
- **Equipos Propios (Mikrotik/Ubiquiti)**: `8291` (Winbox), `8728` (API), `2000`
- **ISP/Telecom**: `7547` (TR-069), `5060` (VoIP), `53` (DNS), `161` (SNMP)

---

## 5. Parámetros Técnicos y Timeouts

Debido a la latencia internacional, los parámetros están ajustados:

- **TCP Timeout**: 3,000ms.
- **Concurrencia**: 200 checks simultáneos por trabajador.
- **Paralelismo**: 5 bloques simultáneos.

---

## 6. Enriquecimiento de Datos (Deep Classification)

Una vez descubiertas las IPs, ejecuta el enriquecimiento para clasificar qué clase de dispositivos son (Router, Antena, Servidor, etc.).

```bash
# Procesa TODOS los nodos activos en la base de datos
npx tsx scripts/enrich-ips.ts
```

Este script extrae:
1. Certificados SSL (subjects/issuers).
2. Nombres de dominio vía Reverse DNS (PTR).
3. Cabeceras HTTP (Server, WWW-Authenticate).
