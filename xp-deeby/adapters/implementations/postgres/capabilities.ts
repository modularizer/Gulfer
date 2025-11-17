import {Dialect} from "../../abstract/capabilities";
import {PlatformName} from "../../../platform";


export const adapterName = 'postgres';
export type AdapterType = typeof adapterName;
export interface PostgresConnectionConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean | 'prefer';
}
export interface RegistryEntry {
    name: string;
    adapterType: AdapterType;
    connectionInfo: PostgresConnectionConfig;
}
export const capabilities = {
    adapterType: adapterName,
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
}