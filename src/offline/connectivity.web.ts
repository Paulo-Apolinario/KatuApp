import type { ConnectivityStatus } from './connectivity';
function state(): ConnectivityStatus { const connected = typeof navigator !== 'undefined' && navigator.onLine !== false; return { isConnected: connected, isInternetReachable: connected, isOffline: !connected }; }
/** Browser availability is a hint; actual API errors keep operations pending. No third-party reachability probe. */
export async function getCurrentConnectivity() { return state(); }
export function subscribeToConnectivity(callback: (status: ConnectivityStatus) => void) { const update = () => callback(state()); update(); if (typeof window === 'undefined')
    return () => { }; window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }
