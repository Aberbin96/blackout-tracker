# Database Schema Documentation

This document serves as the single source of truth for the current state of the Supabase PostgreSQL database for the Blackout Tracker project.

## 1. Core Tables

### `monitoring_targets`

Stores all the active IPs (nodes) that the system has discovered and monitors continuously.

| Column                    | Type        | Default/Constraints | Description                                                          |
| :------------------------ | :---------- | :------------------ | :------------------------------------------------------------------- |
| `ip`                      | TEXT        | PRIMARY KEY         | The IP address of the node                                           |
| `provider`                | TEXT        | NOT NULL            | ISP name (e.g., 'CANTV', 'Inter')                                    |
| `asn`                     | INTEGER     | NOT NULL            | Autonomous System Number                                             |
| `state`                   | TEXT        | NOT NULL            | Normalized Venezuelan state                                          |
| `city`                    | TEXT        |                     | City localized by IP-API                                             |
| `zip`                     | TEXT        |                     | ZIP code                                                             |
| `lat`                     | NUMERIC     |                     | Latitude                                                             |
| `lon`                     | NUMERIC     |                     | Longitude                                                            |
| `timezone`                | TEXT        |                     | Timezone string                                                      |
| `hostname`                | TEXT        |                     | Reverse DNS hostname                                                 |
| `is_mobile`               | BOOLEAN     | false               | True if it's a mobile carrier IP (Digitel/Movistar)                  |
| `network_type`            | TEXT        | 'fixed'             | 'fixed' or 'mobile'                                                  |
| `device_type`             | TEXT        | 'unknown'           | 'router', 'cctv', 'web', etc. (from classifier)                      |
| `is_proxy`                | BOOLEAN     | false               | True if detected as VPN/Proxy by IP-API                              |
| `classification_metadata` | JSONB       | '{}'                | Stores raw HTTP/HTTPS headers used for classification                |
| `services`                | INT[]       |                     | Array of open ports found during discovery (e.g., `[80, 443, 8291]`) |
| `is_active`               | BOOLEAN     | true                | Indicates if the node is actively polled by the checker              |
| `created_at`              | TIMESTAMPTZ | NOW()               | When it was first discovered                                         |
| `last_checked_at`         | TIMESTAMPTZ | NULL                | When the node was last verified by the ping check                    |
| `updated_at`              | TIMESTAMPTZ | NOW()               | Last metadata update                                                 |

### `connectivity_checks`

Stores the results of the periodic pings (cron jobs/health checks) to calculate uptime and map data.

| Column      | Type        | Default/Constraints | Description                         |
| :---------- | :---------- | :------------------ | :---------------------------------- |
| `id`        | BIGSERIAL   | PRIMARY KEY         | Unique ID                           |
| `ip`        | TEXT        | NOT NULL            | Foreign key reference to targets    |
| `status`    | TEXT        | 'offline'/'online'  | Current health status               |
| `latency`   | INTEGER     | NULL                | Latency in milliseconds (if online) |
| `provider`  | TEXT        |                     | Copied for fast analytical querying |
| `state`     | TEXT        |                     | Copied for fast analytical querying |
| `timestamp` | TIMESTAMPTZ | NOW()               | When the check happened             |

_Note: Data in this table is typically pruned (e.g., keeping only 7 to 30 days) to prevent massive DB growth._

### `blackout_events`

Stores confirmed regional blackouts calculated by the Analytical Engine (>40% drop).

| Column          | Type        | Default/Constraints | Description                                |
| :-------------- | :---------- | :------------------ | :----------------------------------------- |
| `id`            | BIGSERIAL   | PRIMARY KEY         | Unique ID                                  |
| `state`         | TEXT        | NOT NULL            | State experiencing the outage              |
| `nodes_total`   | INTEGER     | NOT NULL            | Total monitored nodes in state at the time |
| `nodes_offline` | INTEGER     | NOT NULL            | Absolute number of nodes down              |
| `status`        | TEXT        | 'active'/'resolved' | Current state of the event                 |
| `started_at`    | TIMESTAMPTZ | NOW()               | Engine detection time                      |
| `ended_at`      | TIMESTAMPTZ | NULL                | Time recovery was confirmed (<20% down)    |
| `created_at`    | TIMESTAMPTZ | NOW()               | Record creation time                       |

## 2. Utility Tables (Discovery Tools)

### `scanned_prefixes`

Tracks which CIDR blocks have been swept by the script to avoid duplicate work.

| Column       | Type        | Default/Constraints | Description                             |
| :----------- | :---------- | :------------------ | :-------------------------------------- |
| `prefix`     | TEXT        | PRIMARY KEY         | Network CIDR (e.g., '190.121.228.0/24') |
| `provider`   | TEXT        |                     | Target ISP                              |
| `asn`        | INTEGER     |                     | Corresponding ASN                       |
| `scanned_at` | TIMESTAMPTZ | NOW()               | Timestamp                               |

### `ip_geolocation_cache`

A local cache table to avoid hitting IP-API limits iteratively during aggressive discoveries.

| Column       | Type        | Default/Constraints | Description                   |
| :----------- | :---------- | :------------------ | :---------------------------- |
| `ip`         | TEXT        | PRIMARY KEY         | IP address                    |
| `data`       | JSONB       | NOT NULL            | Complete response from IP-API |
| `updated_at` | TIMESTAMPTZ | NOW()               | When it was cached            |

## 3. Recommended Indexes

- `monitoring_targets (lat, lon)`: For map rendering
- `monitoring_targets (device_type, network_type)`: For distribution graphs
- `monitoring_targets (is_active)`: For ping loops
- `connectivity_checks (timestamp)`: For historical cleanup/retention queries
- `blackout_events (state)` WHERE `status = 'active'`: For rapid blackout polling
