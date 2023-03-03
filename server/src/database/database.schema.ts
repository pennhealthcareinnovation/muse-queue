import type { ColumnType, Generated, Selectable } from "kysely";

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

/**
 * Tables within the global public schema
 */
export interface PublicSchema {
  batch: batch
  queueItem: queueItem
  worker: worker
}

export interface batch {
  id: Generated<number>
  description: string | null;
  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface queueItem {
  id: Generated<number>

  batchId: batch['id'];
  uid: string
  site: number

  expectedCount?: number

  lockedAt?: Timestamp
  lockedBy?: worker['name']

  completedAt?: Timestamp
  matchedCount?: number

  confirmedCount?: number

  createdAt: Generated<Timestamp>;
  updatedAt: Generated<Timestamp>;
}

export interface worker {
  id: Generated<number>

  name: string
  triggerUrl: string
  active: boolean
  pendingStart: boolean
}