import {PlatformName} from "../../platform";

export enum Dialect {
    POSTGRES = 'postgres',
    SQLITE = 'sqlite',
}

export type AdapterType = string;
export interface RegistryEntry {
    name: string;
    adapterType: string;
    config?: Record<string, any>;
    connectionInfo?: Record<string, any>; // Adapter-specific connection info
    metadata?: Record<string, any>; // Additional metadata
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

