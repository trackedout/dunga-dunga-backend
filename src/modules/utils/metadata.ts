import { ObjectId } from 'mongoose';

export interface EventMetadataContainer {
  _id?: ObjectId;
  metadata: Map<string, any> | any;
}

export function getEventMetadata(event: EventMetadataContainer): Map<string, any> {
  return event.metadata instanceof Map ? event.metadata : new Map(Object.entries(event.metadata || {}));
}

export function getMetadata(metadata: Object): Map<string, any> {
  return metadata instanceof Map ? metadata : new Map(Object.entries(metadata || {}));
}

// Normalise any Mongoose Map-typed field into a real Map<string, V>.
//
// Mongoose Map fields (schema `type: Map`) are a `Map` on a hydrated document
// but a plain object on a `.lean()` result or a value built from config. Bracket
// access (`doc.field['key']`) SILENTLY returns undefined on a real Map, which is
// a subtle, hard-to-spot bug (it broke league shard seeding). Always route Map
// field reads through this so both shapes work.
export function asMap<V = any>(field: unknown): Map<string, V> {
  if (field instanceof Map) return field as Map<string, V>;
  return new Map(Object.entries((field as Record<string, V>) || {}));
}

// Read a single keyed entry from a Mongoose Map-typed field, tolerating both the
// hydrated-Map and plain-object shapes.
export function getMapValue<V = any>(field: unknown, key: string): V | undefined {
  return asMap<V>(field).get(key);
}
