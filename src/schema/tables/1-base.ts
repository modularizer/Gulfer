import {text, real, jsonb, uuidPK, table, index} from '../adapters';

export const baseColumns = {
    id: uuidPK('id'), // 16 hex character UUID
    name: text('name').unique(),
    notes: text('notes', { length: 200 }),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
};

export const latLngIdx = (table: any) => index(`${table.tableName}_lat_lng_idx`).on(table.lat, table.lng);
