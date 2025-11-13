export interface NavigationState {
    pathname: string;
    searchParams?: Record<string, string>;
    timestamp: number;
}