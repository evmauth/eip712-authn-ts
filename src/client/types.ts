/**
 * TypeScript types for EIP-1193, a JavaScript Ethereum Provider API for consistency across clients and applications,
 * using EIP-6963 events as an alternative discovery mechanism to `window.ethereum`, to support discovering multiple
 * injected Wallet Providers in a web page using Javascript’s window events.
 *
 * See also:
 * - https://eips.ethereum.org/EIPS/eip-1193
 * - https://eips.ethereum.org/EIPS/eip-6963
 */

// Global event types
declare global {
    interface WindowEventMap {
        'eip6963:announceProvider': CustomEvent<EIP6963ProviderDetail>;
        'eip6963:requestProvider': Event;
    }
}

export interface EIP1193Provider {
    request: (request: { method: string; params?: Array<unknown> }) => Promise<unknown>;
    on: (eventName: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (eventName: string, callback: (...args: unknown[]) => void) => void;
}

export interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

export interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo;
    provider: EIP1193Provider;
}
