import { IEvent } from '../event/event.interfaces';

export function getEventMetadata(event: IEvent): Map<string, any> {
    return event.metadata instanceof Map ? event.metadata : new Map(Object.entries(event.metadata || {}));
}

export function getMetadata(metadata: Object): Map<string, any> {
    return metadata instanceof Map ? metadata : new Map(Object.entries(metadata || {}));
}
