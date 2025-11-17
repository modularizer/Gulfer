import {Dialect} from "../../abstract/capabilities";
import {PlatformName} from "../../../platform";


export const adapterName = 'sqlite-mobile';
export type AdapterType = typeof adapterName;
export interface RegistryEntry {
    name: string;
    adapterType: AdapterType;
    connectionInfo: Record<string, any>;
}
export const capabilities = {
    adapterType: adapterName,
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
}