
import * as pglite from "./pglite/capabilities";
import * as postgres from "./postgres/capabilities";
import * as sqliteMobile from "./sqlite-mobile/capabilities";
import {PlatformName} from "../../platform";


export enum AdapterType {
    PGLITE = pglite.adapterName,
    SQLITE_MOBILE = sqliteMobile.adapterName,
    POSTGRES = postgres.adapterName,
}

export const defaultAdapterByHostPlatform: Record<PlatformName, AdapterType> = {
    [PlatformName.WEB]: AdapterType.PGLITE,
    [PlatformName.MOBILE]: AdapterType.SQLITE_MOBILE,
    [PlatformName.NODE]: AdapterType.POSTGRES
}



