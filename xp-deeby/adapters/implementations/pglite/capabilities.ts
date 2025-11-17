import {PlatformName} from "../../../platform";
import {Dialect} from "../../abstract/capabilities";


export const adapterName = 'pglite';
export type AdapterType = typeof adapterName;
export interface RegistryEntry {
    name: string;
    adapterType: AdapterType;
}
export const capabilities = {
    adapterType: adapterName,
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
}