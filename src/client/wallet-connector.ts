import type { EIP1193Provider, EIP6963ProviderDetail } from './types.js';

export class WalletConnector {
    private providers: EIP6963ProviderDetail[] = [];
    private selectedProvider: EIP6963ProviderDetail | null = null;
    private address: string | null = null;

    // Event listeners for wallet connection changes
    private addressChangeListeners: ((address: string | null) => void)[] = [];
    private providerChangeListeners: ((provider: EIP6963ProviderDetail | null) => void)[] = [];
    private providerListChangeListeners: ((provider: EIP6963ProviderDetail | null) => void)[] = [];

    constructor() {
        // Initialize the listener for EIP-6963 provider announcements
        this.initializeProviderDiscovery();
    }

    /**
     * Initialize EIP-6963 provider discovery
     */
    private initializeProviderDiscovery(): void {
        if (typeof window === 'undefined') return;

        // Listen for provider announcements
        window.addEventListener('eip6963:announceProvider', (event) => {
            const providerDetail = event.detail;
            if (!this.providers.some((p) => p.info.uuid === providerDetail.info.uuid)) {
                this.providers.push(providerDetail);
                this.notifyProviderListChanged(providerDetail);
            }
        });

        // Request providers on initialization
        setTimeout(() => {
            window.dispatchEvent(new Event('eip6963:requestProvider'));
        }, 0);
    }

    /**
     * Get all discovered wallet providers
     */
    public getProviders(): EIP6963ProviderDetail[] {
        return [...this.providers];
    }

    /**
     * Connect to a specific wallet provider
     */
    public async connect(provider: EIP6963ProviderDetail): Promise<string | null> {
        try {
            const accounts = (await provider.provider.request({
                method: 'eth_requestAccounts',
            })) as string[];

            if (accounts && accounts.length > 0) {
                this.address = accounts[0];
                this.selectedProvider = provider;

                // Set up event listeners for account changes
                this.setupProviderListeners(provider.provider);

                // Store connection info if persistent connections are desired
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem('walletAddress', this.address);
                    localStorage.setItem('walletProviderUuid', provider.info.uuid);
                }

                // Notify listeners
                this.notifyAddressChanged();
                this.notifyProviderChanged();

                return this.address;
            }
            return null;
        } catch (error) {
            console.error('Error connecting wallet:', error);
            throw new Error('Failed to connect wallet');
        }
    }

    /**
     * Set up listeners for wallet events
     */
    private setupProviderListeners(provider: EIP1193Provider): void {
        // Handle account changes
        const handleAccountsChanged = ((accounts: unknown) => {
            if (!Array.isArray(accounts)) {
                console.error('Invalid accounts data received');
                return;
            }

            if (accounts.length === 0) {
                // User disconnected their wallet
                this.disconnect();
            } else if (this.address !== accounts[0]) {
                this.address = accounts[0];
                this.notifyAddressChanged();
            }
        }) as (...args: unknown[]) => void;

        // Handle chain changes
        const handleChainChanged = (() => {
            // For some wallets, chain changes might require resetting the connection
            this.notifyAddressChanged();
        }) as (...args: unknown[]) => void;

        // Handle disconnect events
        const handleDisconnect = (() => {
            this.disconnect();
        }) as (...args: unknown[]) => void;

        // Register listeners
        provider.on('accountsChanged', handleAccountsChanged);
        provider.on('chainChanged', handleChainChanged);
        provider.on('disconnect', handleDisconnect);

        // Store listeners for later removal
        this.cleanupListeners = () => {
            provider.removeListener('accountsChanged', handleAccountsChanged);
            provider.removeListener('chainChanged', handleChainChanged);
            provider.removeListener('disconnect', handleDisconnect);
        };
    }

    private cleanupListeners: (() => void) | null = null;

    /**
     * Disconnect the current wallet
     */
    public disconnect(): void {
        // Clean up event listeners
        if (this.cleanupListeners) {
            this.cleanupListeners();
            this.cleanupListeners = null;
        }

        // Reset state
        this.address = null;
        this.selectedProvider = null;

        // Clear stored connection info
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('walletAddress');
            localStorage.removeItem('walletProviderUuid');
        }

        // Notify listeners
        this.notifyAddressChanged();
        this.notifyProviderChanged();
    }

    /**
     * Reconnect to a previously connected wallet if possible
     */
    public async reconnect(): Promise<string | null> {
        if (typeof localStorage === 'undefined' || typeof window === 'undefined') {
            return null;
        }

        const savedAddress = localStorage.getItem('walletAddress');
        const savedProviderUuid = localStorage.getItem('walletProviderUuid');

        if (!savedAddress || !savedProviderUuid) {
            return null;
        }

        // Wait for providers to be discovered
        if (this.providers.length === 0) {
            // Wait a bit for providers to be announced
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const provider = this.providers.find((p) => p.info.uuid === savedProviderUuid);
        if (!provider) {
            return null;
        }

        return this.connect(provider);
    }

    /**
     * Sign a message using EIP-712 typed data
     */
    public async signTypedData(message: string): Promise<string> {
        if (!this.selectedProvider?.provider || !this.address) {
            throw new Error('No wallet connected');
        }

        return (await this.selectedProvider.provider.request({
            method: 'eth_signTypedData_v4',
            params: [this.address, message],
        })) as string;
    }

    /**
     * Get the current network ID
     */
    public async getChainId(): Promise<number> {
        if (!this.selectedProvider?.provider) {
            throw new Error('No wallet connected');
        }

        const chainIdHex = (await this.selectedProvider.provider.request({
            method: 'eth_chainId',
        })) as string;

        return Number.parseInt(chainIdHex, 16);
    }

    /**
     * Get the current connected address
     */
    public getAddress(): string | null {
        return this.address;
    }

    /**
     * Get the currently selected provider
     */
    public getSelectedProvider(): EIP6963ProviderDetail | null {
        return this.selectedProvider;
    }

    /**
     * Add listener for address changes
     */
    public onAddressChange(listener: (address: string | null) => void): () => void {
        this.addressChangeListeners.push(listener);
        return () => {
            this.addressChangeListeners = this.addressChangeListeners.filter((l) => l !== listener);
        };
    }

    /**
     * Add listener for provider changes
     */
    public onProviderChange(
        listener: (provider: EIP6963ProviderDetail | null) => void
    ): () => void {
        this.providerChangeListeners.push(listener);
        return () => {
            this.providerChangeListeners = this.providerChangeListeners.filter(
                (l) => l !== listener
            );
        };
    }

    /**
     * Add listener for provider list changes
     */
    public onProviderListChange(
        listener: (provider: EIP6963ProviderDetail | null) => void
    ): () => void {
        this.providerListChangeListeners.push(listener);
        return () => {
            this.providerListChangeListeners = this.providerListChangeListeners.filter(
                (l) => l !== listener
            );
        };
    }

    private notifyAddressChanged(): void {
        for (const listener of this.addressChangeListeners) {
            listener(this.address);
        }
    }

    private notifyProviderChanged(): void {
        for (const listener of this.providerChangeListeners) {
            listener(this.selectedProvider);
        }
    }

    private notifyProviderListChanged(providerDetail: EIP6963ProviderDetail): void {
        for (const listener of this.providerListChangeListeners) {
            listener(providerDetail);
        }
    }
}

// Create a singleton instance
export const walletConnector = new WalletConnector();
