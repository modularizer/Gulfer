export enum PlatformName {
    WEB = 'web',
    MOBILE = 'mobile',
    NODE = 'node'
}

export enum Dialect {
    POSTGRES = 'postgres',
    SQLITE = 'sqlite',
}

export enum AdapterType {
    PGLITE = 'pglite',
    SQLITE_MOBILE = 'sqlite-mobile',
    POSTGRES = 'postgres'
}

/**
 * Registry entry - JSON-serializable description of a database connection
 */
export interface RegistryEntry {
    name: string;
    adapterType: AdapterType;
    connectionInfo?: Record<string, any>; // Adapter-specific connection info
    metadata?: Record<string, any>; // Additional metadata
}


export const defaultAdapterByHostPlatform: Record<PlatformName, AdapterType> = {
    [PlatformName.WEB]: AdapterType.PGLITE,
    [PlatformName.MOBILE]: AdapterType.SQLITE_MOBILE,
    [PlatformName.NODE]: AdapterType.POSTGRES
}


export interface AdapterCapabilities{
    adapterType: AdapterType;
    dialect: Dialect;
    clientPlatforms: {
        [PlatformName.WEB]: boolean;
        [PlatformName.MOBILE]: boolean;
        [PlatformName.NODE]: boolean;
    },
    hostPlatforms: {
        [PlatformName.WEB]: boolean;
        [PlatformName.MOBILE]: boolean;
        [PlatformName.NODE]: boolean;
    }
}


export const adapterCapabilities: Record<AdapterType, AdapterCapabilities> = {
    [AdapterType.PGLITE]: {
        adapterType: AdapterType.PGLITE,
        dialect: Dialect.POSTGRES,
        clientPlatforms: {
            [PlatformName.WEB]: true,
            [PlatformName.MOBILE]: false,
            [PlatformName.NODE]: false,
        },
        hostPlatforms: {
            [PlatformName.WEB]: true,
            [PlatformName.MOBILE]: false,
            [PlatformName.NODE]: false,
        }
    },
    [AdapterType.POSTGRES]: {
        adapterType: AdapterType.POSTGRES,
        dialect: Dialect.POSTGRES,
        clientPlatforms: {
            [PlatformName.WEB]: true,
            [PlatformName.MOBILE]: true,
            [PlatformName.NODE]: true,
        },
        hostPlatforms: {
            [PlatformName.WEB]: false,
            [PlatformName.MOBILE]: false,
            [PlatformName.NODE]: true,
        }
    },
    [AdapterType.SQLITE_MOBILE]: {
        adapterType: AdapterType.SQLITE_MOBILE,
        dialect: Dialect.SQLITE,
        clientPlatforms: {
            [PlatformName.WEB]: false,
            [PlatformName.MOBILE]: true,
            [PlatformName.NODE]: false,
        },
        hostPlatforms: {
            [PlatformName.WEB]: false,
            [PlatformName.MOBILE]: true,
            [PlatformName.NODE]: false,
        }
    },
}


export interface PostgresConnectionConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | 'prefer';
}


