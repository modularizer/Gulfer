export interface OffsetClampAndScale {
    offset?: number;
    min?: number;
    max?: number;
    scale?: number;
}
export const clamp = (value: number, min: number = -Infinity, max: number = Infinity) => Math.max(Math.min(value, max), min);
export const offsetClampAndScale = (value: number, {offset = 0, min = -Infinity, max = Infinity, scale = 1}: OffsetClampAndScale)=> {
    return clamp(value + offset, min, max) * scale;
}