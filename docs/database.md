# Database Schema Documentation

This document is the single source of truth for the Railway MySQL database used by Blackout Tracker. Schema is defined in [`db/schema.ts`](../db/schema.ts) and managed via Drizzle ORM.

## 1. Core Tables

### `monitoring_targets`

Stores all discovered IPs that the system monitors continuously.

| Column                    | Type         | Default      | Description                                           |
| :------------------------ | :----------- | :----------- | :---------------------------------------------------- |
| `id`                      | BIGINT AI PK |              | Auto-increment primary key                            |
| `ip`                      | VARCHAR(45)  | UNIQUE       | IP address of the node                                |
| `provider`                | VARCHAR(100) | NOT NULL     | ISP name (e.g., 'CANTV', 'Inter')                     |
| `asn`                     | INT          |              | Autonomous System Number                              |
| `state`                   | VARCHAR(100) | NOT NULL     | Normalized Venezuelan state                           |
| `city`                    | VARCHAR(100) |              | City from IP-API                                      |
| `zip`                     | VARCHAR(20)  |              | ZIP code                                              |
| `lat`                     | DOUBLE       |              | Latitude                                              |
| `lon`                     | DOUBLE       |              | Longitude                                             |
| `timezone`                | VARCHAR(60)  |              | Timezone string                                       |
| `hostname`                | VARCHAR(255) |              | Reverse DNS hostname                                  |
| `is_mobile`               | BOOLEAN      | false        | True if mobile carrier IP                             |
| `network_type`            | VARCHAR(50)  | 'fixed'      | 'fixed' or 'mobile'                                   |
| `device_type`             | VARCHAR(50)  | 'unknown'    | 'router', 'cctv', 'web', etc. (from classifier)       |
| `is_proxy`                | BOOLEAN      | false        | True if detected as VPN/Proxy by IP-API               |
| `classification_metadata` | JSON         | `{}`         | Raw HTTP/HTTPS headers used for classification        |
| `services`                | JSON         | `[]`         | Array of open ports found during discovery            |
| `is_active`               | BOOLEAN      | true         | Whether the node is actively polled                   |
| `stability_score`         | INT          | 0            | Score 0-100; nodes below MIN_STABILITY_SCORE skipped  |
| `last_ip_change_at`       | TIMESTAMP    | NOW()        | When IP last changed (for stability scoring)          |
| `last_online_at`          | TIMESTAMP    |              | Last time node was seen online                        |
| `last_checked_at`         | TIMESTAMP    |              | Last time node was checked                            |
| `created_at`              | TIMESTAMP    | NOW()        | Discovery timestamp                                   |

### `connectivity_checks`

Results of periodic pings used to calculate uptime and map data.

| Column       | Type         | Default | Description                             |
| :----------- | :----------- | :------ | :-------------------------------------- |
| `id`         | BIGINT AI PK |         | Auto-increment primary key              |
| `ip`         | VARCHAR(45)  | NOT NULL| Target IP                               |
| `provider`   | VARCHAR(100) | NOT NULL| Copied for fast analytical queries      |
| `state`      | VARCHAR(100) | NOT NULL| Copied for fast analytical queries      |
| `status`     | VARCHAR(20)  | NOT NULL| 'online' or 'offline'                   |
| `latency`    | INT          |         | Milliseconds (if online)                |
| `error_type` | VARCHAR(50)  |         | TIMEOUT, ICMP_ONLY, DISCOVERY_OPEN, etc.|
| `timeout_ms` | INT          |         | Timeout used for this check             |
| `timestamp`  | TIMESTAMP    | NOW()   | When the check ran                      |
| `created_at` | TIMESTAMP    | NOW()   | Record creation time                    |

_Rows older than 14 days are pruned by the daily maintenance cron._

### `blackout_events`

Confirmed regional blackouts detected when >40% of nodes in a state go offline.

| Column          | Type              | Default | Description                                |
| :-------------- | :---------------- | :------ | :----------------------------------------- |
| `id`            | BIGINT AI PK      |         | Auto-increment primary key                 |
| `state`         | VARCHAR(100)      | NOT NULL| State experiencing the outage              |
| `nodes_total`   | INT               | NOT NULL| Total monitored nodes in state             |
| `nodes_offline` | INT               | NOT NULL| Absolute number of nodes down              |
| `status`        | ENUM              | NOT NULL| 'active' or 'resolved'                     |
| `started_at`    | TIMESTAMP         | NOW()   | Detection time                             |
| `ended_at`      | TIMESTAMP         |         | Recovery confirmed time (<20% down)        |
| `created_at`    | TIMESTAMP         | NOW()   | Record creation time                       |

## 2. Utility Tables

### `scanned_prefixes`

Tracks which CIDR blocks have been swept by the discovery script to avoid duplicate work.

| Column       | Type         | Default | Description                             |
| :----------- | :----------- | :------ | :-------------------------------------- |
| `prefix`     | VARCHAR(50)  | PK      | Network CIDR (e.g., '190.121.228.0/24') |
| `provider`   | VARCHAR(100) | NOT NULL| Target ISP                              |
| `asn`        | INT          | NOT NULL| Corresponding ASN                       |
| `scanned_at` | TIMESTAMP    | NOW()   | When it was scanned                     |

_Reset monthly by the `monthly-prefix-reset` workflow to re-discover the full IP space._

### `ip_geolocation_cache`

Caches IP-API responses to avoid hitting rate limits during aggressive discoveries.

| Column       | Type         | Default | Description                    |
| :----------- | :----------- | :------ | :----------------------------- |
| `ip`         | VARCHAR(45)  | PK      | IP address                     |
| `data`       | JSON         | NOT NULL| Complete response from IP-API  |
| `created_at` | TIMESTAMP    | NOW()   | When it was first cached       |
| `updated_at` | TIMESTAMP    | NOW()   | When it was last refreshed     |

### `daily_regional_stats`

Pre-aggregated daily rollups for historical charting. Populated by the maintenance cron.

| Column          | Type         | PK  | Description                              |
| :-------------- | :----------- | :-- | :--------------------------------------- |
| `date`          | DATE         | ✓   | The date (composite PK with state+provider) |
| `state`         | VARCHAR(100) | ✓   | State                                    |
| `provider`      | VARCHAR(100) | ✓   | ISP                                      |
| `total_checks`  | BIGINT       |     | Total checks that day                    |
| `online_checks` | BIGINT       |     | Online checks that day                   |
| `avg_latency`   | DOUBLE       |     | Average latency (online nodes only)      |
| `created_at`    | TIMESTAMP    |     | Rollup time                              |

## 3. Indexes

All indexes are defined in `db/schema.ts`. Key ones:

- `monitoring_targets (ip)` — unique
- `monitoring_targets (lat, lon)` — map rendering
- `monitoring_targets (is_active, stability_score)` — ping loop filtering
- `connectivity_checks (timestamp)` — retention queries and time-window aggregates
- `connectivity_checks (state, status)` — active blackout evaluation
- `blackout_events (status, state)` — active blackout lookup
