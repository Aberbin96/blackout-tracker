# Estrategias de Descubrimiento de Red (IP Discovery)

Este documento describe la lógica utilizada por el script `discover-ips.ts` para mapear la infraestructura de red en Venezuela.

## Modos de Escaneo

El script utiliza el parámetro `--aggressive` para determinar la densidad del escaneo.

### 1. Escaneo Normal (Sampling Ligero)

- **Bloques /24**: Escanea solo 10 IPs representativas.
- **Bloques /16 a /23**: Escanea 15 sub-bloques aleatorios (90 IPs total).
- **Bloques < /16**: Escanea 40 muestras aleatorias.
- **Uso**: Ideal para monitoreo de rutina sin saturar ancho de banda.

### 2. Modo Agresivo (Super Aggressive Strategy)

Este modo se activa con el flag `--aggressive` y está optimizado para encontrar la máxima cantidad de nodos vivos.

| Tamaño del Bloque (CIDR)      | Estrategia       | Densidad                   |
| ----------------------------- | ---------------- | -------------------------- |
| **<= /22** (hasta 1,024 IPs)  | **Full Scan**    | **100%** (IP por IP)       |
| **/16 a /21**                 | Denser Sampling  | 120 sub-bloques (~720 IPs) |
| **< /16** (Grandes Backbones) | Massive Sampling | 400 muestras aleatorias    |

## Configuración de Timeouts

Debido a que el escaneo se realiza habitualmente desde fuera de Venezuela, los parámetros de red están ajustados para compensar la latencia internacional:

- **TCP Timeout**: 3,000ms (3 segundos).
- **Paralelismo de Prefijos**: 5 bloques simultáneos.
- **Concurrencia de IPs**: 200 checks simultáneos por trabajador.

## Cómo modificar la agresividad

La lógica reside en la función `getCandidates` dentro de `scripts/discover-ips.ts`.

Para aumentar el alcance del "Full Scan" a bloques más grandes (por ejemplo, para cubrir todo Inter o Movistar), se debe modificar esta línea:

```typescript
if (aggressive && mask >= 22) { ... }
```

Cambiando el `22` por un número menor (ej. `20` para cubrir bloques de 4,096 IPs).
