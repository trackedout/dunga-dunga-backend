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
