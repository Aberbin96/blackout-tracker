# Comandos de Descubrimiento de Red (Discovery Commands)

Este documento contiene los comandos avanzados para ejecutar el escáner de red de forma **súper agresiva**. Utilizan los scripts de descubrimiento para buscar la mayor cantidad posible de nodos activos por proveedor, saltándose las muestras aleatorias y escaneando profundamente los bloques IP.

## 1. Escaneo Súper Agresivo por Proveedor

Si quieres apuntar todo el poder de escaneo a un proveedor específico, solo copia y pega su comando:

```bash
# Gandalf (Proveedores muy pequeños) X
npx tsx scripts/discover-ips.ts --provider="Gandalf" --aggressive

# Gold Data X
npx tsx scripts/discover-ips.ts --provider="Gold Data" --aggressive

# VNET
npx tsx scripts/discover-ips.ts --provider="VNET" --aggressive

# Netcom Plus
npx tsx scripts/discover-ips.ts --provider="Netcom Plus" --aggressive

# Fibex
npx tsx scripts/discover-ips.ts --provider="Fibex" --aggressive

# Thundernet (Gran crecimiento)
npx tsx scripts/discover-ips.ts --provider="Thundernet" --aggressive

# Airtek (Gran volumen en Zulia)
npx tsx scripts/discover-ips.ts --provider="Airtek" --aggressive

# Net Uno (Nacional Mediano)
npx tsx scripts/discover-ips.ts --provider="Net Uno" --aggressive

# Inter (Nacional Grande)
npx tsx scripts/discover-ips.ts --provider="Inter" --aggressive

# Movistar (Móvil y Fijo Nacional)
npx tsx scripts/discover-ips.ts --provider="Movistar" --aggressive

# Digitel (Móvil y Fijo Nacional)
npx tsx scripts/discover-ips.ts --provider="Digitel" --aggressive

# CANTV (El gigante estatal)
npx tsx scripts/discover-ips.ts --provider="CANTV" --aggressive
```

## 2. Escanear Múltiples Proveedores a la Vez

Puedes pasar la bandera `--provider` varias veces para encolar varios escaneos en una sola ejecución.

```bash
npx tsx scripts/discover-ips.ts --provider="Airtek" --provider="Thundernet" --provider="Netcom Plus" --aggressive
```

## 3. Filtrar Solo Bloques Muy Densos (Full Only)

Si quieres un escaneo aún más rápido que solo mire las subredes que Censys ha reportado como "casi llenas" (con más del 80% de IPs activas), añade la bandera `--full-only`. Esto ignora los bloques vacíos.

```bash
# Escaneo súper rápido y agresivo solo en subredes densas de CANTV
npx tsx scripts/discover-ips.ts --provider="CANTV" --aggressive --full-only
```

## 4. Escaneo Global Agresivo (Todos los Proveedores)

Si necesitas recorrer **TODOS** los proveedores activos a la vez a nivel nacional sin límites y en modo super agresivo (el proceso más masivo posible):

```bash
# Escaneo de TODOS los proveedores que tienes configurados de forma agresiva
npx tsx scripts/run-all-discovery.ts --aggressive
```

> **Aviso de Rendimiento:** El modo `--aggressive` desactiva gran parte del límite de muestreo aleatorio. Revisará bloques de red enteros (/21, /20, etc.) secuencialmente al 100%. Esto consumirá mucha CPU y generará más de 10,000 requests por minuto, por lo que es ideal correrlo en un entorno donde tengas buen ancho de banda.

## 5. Enriquecimiento de Datos (Deep Classification de Todos los Proveedores)

Una vez que hayas descubierto o re-escaneado múltiples IPs en la base de datos (ya sea de un proveedor en específico o de todos), debes ejecutar el script de enriquecimiento para que el sistema clasifique qué clase de dispositivos son (Router Residencial, Módem de ISP, Antena Mikrotik, Servidor Web, etc.).

El script de enriquecimiento lee todos los nodos de **TODOS los proveedores en base de datos al mismo tiempo** e intentará:

1. Extraer los certificados SSL (`subjects` e `issuers`).
2. Resolver el nombre de dominio vía **Reverse DNS (PTR)** (Ej. `host-100-24.cantv.net`).
3. Extraer el Servidor HTTP y cabeceras de administración como `WWW-Authenticate` de los routers de los proveedores.

Para ejecutar todo este enriquecimiento masivo en los nodos activos:

```bash
npx tsx scripts/enrich-targets.ts
```
