import {
  mysqlTable,
  bigint,
  varchar,
  int,
  double,
  boolean,
  json,
  timestamp,
  date,
  mysqlEnum,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const connectivityChecks = mysqlTable(
  "connectivity_checks",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    ip: varchar("ip", { length: 45 }).notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    latency: int("latency"),
    errorType: varchar("error_type", { length: 50 }),
    timeoutMs: int("timeout_ms"),
    timestamp: timestamp("timestamp").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("idx_checks_ip").on(t.ip),
    index("idx_checks_timestamp").on(t.timestamp),
    index("idx_checks_provider").on(t.provider),
    index("idx_checks_state").on(t.state),
    index("idx_connectivity_checks_timestamp_state_provider").on(t.timestamp, t.state, t.provider),
    index("idx_connectivity_checks_state_status").on(t.state, t.status),
  ],
);

export const monitoringTargets = mysqlTable(
  "monitoring_targets",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    ip: varchar("ip", { length: 45 }).notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    asn: int("asn"),
    state: varchar("state", { length: 100 }).notNull(),
    city: varchar("city", { length: 100 }),
    zip: varchar("zip", { length: 20 }),
    lat: double("lat"),
    lon: double("lon"),
    timezone: varchar("timezone", { length: 60 }),
    hostname: varchar("hostname", { length: 255 }),
    isMobile: boolean("is_mobile").default(false),
    isProxy: boolean("is_proxy").default(false),
    services: json("services").$type<number[]>().default([]),
    metadata: json("metadata").$type<Record<string, any>>().default({}),
    deviceType: varchar("device_type", { length: 50 }).default("unknown"),
    networkType: varchar("network_type", { length: 50 }).default("fixed"),
    classificationMetadata: json("classification_metadata").$type<Record<string, any>>().default({}),
    isActive: boolean("is_active").default(true),
    stabilityScore: int("stability_score").default(0),
    lastIpChangeAt: timestamp("last_ip_change_at").defaultNow(),
    lastOnlineAt: timestamp("last_online_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_targets_ip").on(t.ip),
    index("idx_targets_state").on(t.state),
    index("idx_targets_provider").on(t.provider),
    index("idx_targets_active").on(t.isActive),
    index("idx_targets_stability").on(t.stabilityScore),
    index("idx_targets_is_mobile").on(t.isMobile),
    index("idx_targets_is_proxy").on(t.isProxy),
    index("idx_targets_device_type").on(t.deviceType),
    index("idx_targets_network_type").on(t.networkType),
    index("idx_targets_geo").on(t.lat, t.lon),
  ],
);

export const blackoutEvents = mysqlTable(
  "blackout_events",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    state: varchar("state", { length: 100 }).notNull(),
    nodesTotal: int("nodes_total").notNull(),
    nodesOffline: int("nodes_offline").notNull(),
    status: mysqlEnum("status", ["active", "resolved"]).notNull(),
    startedAt: timestamp("started_at").defaultNow(),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("idx_blackout_active_state").on(t.status, t.state),
    index("idx_blackout_started").on(t.startedAt),
  ],
);

export const scannedPrefixes = mysqlTable("scanned_prefixes", {
  prefix: varchar("prefix", { length: 50 }).primaryKey(),
  provider: varchar("provider", { length: 100 }).notNull(),
  asn: int("asn").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow(),
});

export const ipGeolocationCache = mysqlTable("ip_geolocation_cache", {
  ip: varchar("ip", { length: 45 }).primaryKey(),
  data: json("data").$type<Record<string, any>>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dailyRegionalStats = mysqlTable(
  "daily_regional_stats",
  {
    date: date("date").notNull(),
    state: varchar("state", { length: 100 }).notNull(),
    provider: varchar("provider", { length: 100 }).notNull(),
    totalChecks: bigint("total_checks", { mode: "number" }),
    onlineChecks: bigint("online_checks", { mode: "number" }),
    avgLatency: double("avg_latency"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.date, t.state, t.provider] })],
);
