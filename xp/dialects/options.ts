import postgres from './implementations/pg';
import sqlite from './implementations/sqlite';

export enum XPDialect {
    POSTGRES = 'pg',
    SQLITE = 'sqlite',
}

export const dialectColumnBuilders = {
    [XPDialect.POSTGRES]: postgres,
    [XPDialect.SQLITE]: sqlite,
}