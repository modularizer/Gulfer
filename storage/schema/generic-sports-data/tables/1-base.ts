import {text, varchar, real, jsonb, uuidPK,index} from '../../../../xp-deeby/xp-schema';

export const baseColumns = {
    id: uuidPK('id'), // 16 hex character UUID
    name: text('name').unique(),
    notes: varchar('notes', { length: 200 }),
    lat: real("lat"),
    lng: real("lng"),
    metadata: jsonb('metadata').$type<Record<string, any>>(),
};

export const latLngIdx = (table: any) => index(`${table.tableName}_lat_lng_idx`).on(table.lat, table.lng);
