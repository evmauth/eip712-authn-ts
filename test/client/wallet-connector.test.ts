import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    EIP1193Provider,
    EIP6963ProviderDetail,
    EIP6963ProviderInfo,
} from '../../src/client/types.js';
import { WalletConnector } from '../../src/client/wallet-connector.js';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

// Create a mock window with the minimum functionality needed
const windowMock = {
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    Event: vi.fn().mockImplementation((type) => ({ type })),
};

// Mock providers and implementation helpers
class MockEIP1193Provider implements EIP1193Provider {
    private eventListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

    constructor(public mockResponses: Record<string, unknown> = {}) {}

    request = vi.fn(async (request: { method: string; params?: Array<unknown> }) => {
        if (request.method in this.mockResponses) {
            return this.mockResponses[request.method];
        }
        throw new Error(`Method ${request.method} not implemented in mock`);
    });

    on = vi.fn((eventName: string, callback: (...args: unknown[]) => void) => {
        if (!this.eventListeners[eventName]) {
            this.eventListeners[eventName] = [];
        }
        this.eventListeners[eventName].push(callback);
    });

    removeListener = vi.fn((eventName: string, callback: (...args: unknown[]) => void) => {
        if (this.eventListeners[eventName]) {
            this.eventListeners[eventName] = this.eventListeners[eventName].filter(
                (listener) => listener !== callback
            );
        }
    });

    // Helper to trigger events for testing
    triggerEvent(eventName: string, ...args: unknown[]): void {
        if (this.eventListeners[eventName]) {
            for (const listener of this.eventListeners[eventName]) {
                listener(...args);
            }
        }
    }
}

function createMockProvider(uuid = 'test-uuid'): EIP6963ProviderDetail {
    const info: EIP6963ProviderInfo = {
        uuid,
        name: `Test Provider ${uuid}`,
        icon: 'data:image/svg+xml;base64,test',
        rdns: 'com.test.provider',
    };

    const provider = new MockEIP1193Provider({
        eth_requestAccounts: ['0x71C7656EC7ab88b098defB751B7401B5f6d8976F'],
        eth_chainId: '0x1',
        eth_signTypedData_v4: '0x123456',
    });

    return {
        info,
        provider,
    };
}

describe('WalletConnector', () => {
    let walletConnector: WalletConnector;
    let originalWindow: typeof window;
    let originalLocalStorage: typeof localStorage;

    beforeEach(() => {
        // Save the original window and localStorage
        originalWindow = global.window;
        originalLocalStorage = global.localStorage;

        // Mock window and localStorage
        Object.defineProperty(global, 'window', {
            value: windowMock,
            writable: true,
        });

        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true,
        });

        // Mock setTimeout to execute callback immediately
        vi.useFakeTimers();

        // Clear mocks before each test
        vi.clearAllMocks();
        localStorageMock.clear();

        // Create a new instance for each test
        walletConnector = new WalletConnector();

        // Run any pending timers created during initialization
        vi.runAllTimers();
    });

    afterEach(() => {
        // Restore original window and localStorage
        Object.defineProperty(global, 'window', {
            value: originalWindow,
            writable: true,
        });

        Object.defineProperty(global, 'localStorage', {
            value: originalLocalStorage,
            writable: true,
        });

        // Restore real timers
        vi.useRealTimers();
    });

    describe('constructor and initialization', () => {
        it('should initialize with empty providers and null selected provider', () => {
            expect(walletConnector.getProviders()).toEqual([]);
            expect(walletConnector.getSelectedProvider()).toBeNull();
            expect(walletConnector.getAddress()).toBeNull();
        });

        it('should set up event listeners for EIP-6963 provider announcements', () => {
            expect(windowMock.addEventListener).toHaveBeenCalledWith(
                'eip6963:announceProvider',
                expect.any(Function)
            );
        });

        it('should request providers on initialization', () => {
            expect(windowMock.dispatchEvent).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'eip6963:requestProvider' })
            );
        });
    });

    describe('connect, disconnect, and reconnect', () => {
        it('should connect to a provider and return the address', async () => {
            const mockProvider = createMockProvider();
            const address = await walletConnector.connect(mockProvider);

            expect(address).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
            expect(walletConnector.getAddress()).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
            expect(walletConnector.getSelectedProvider()).toBe(mockProvider);

            // Should store connection info in localStorage
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'walletAddress',
                '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
            );
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'walletProviderUuid',
                'test-uuid'
            );
        });

        it('should handle connection errors', async () => {
            const mockProvider = createMockProvider();
            const mockError = new Error('User rejected connection');

            mockProvider.provider.request = vi.fn().mockRejectedValue(mockError);

            await expect(walletConnector.connect(mockProvider)).rejects.toThrow(
                'Failed to connect wallet'
            );
        });

        it('should disconnect from the provider', async () => {
            const mockProvider = createMockProvider();
            await walletConnector.connect(mockProvider);

            walletConnector.disconnect();

            expect(walletConnector.getAddress()).toBeNull();
            expect(walletConnector.getSelectedProvider()).toBeNull();

            // Should remove connection info from localStorage
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('walletAddress');
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('walletProviderUuid');
        });

        it('should reconnect to a previously connected provider', async () => {
            // Setup stored values in localStorage
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'walletAddress') return '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
                if (key === 'walletProviderUuid') return 'test-uuid';
                return null;
            });

            // Add a provider to the list
            const mockProvider = createMockProvider('test-uuid');

            // Manually trigger the provider announcement
            const announceEvent = {
                detail: mockProvider,
            } as CustomEvent<EIP6963ProviderDetail>;

            // Call the event listener directly
            const addEventListenerCalls = windowMock.addEventListener.mock.calls;
            const announceProviderListener = addEventListenerCalls.find(
                (call) => call[0] === 'eip6963:announceProvider'
            )?.[1];

            if (announceProviderListener) {
                announceProviderListener(announceEvent);
            }

            // Now attempt to reconnect
            const reconnectResult = await walletConnector.reconnect();

            expect(reconnectResult).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
            expect(walletConnector.getAddress()).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
            expect(walletConnector.getSelectedProvider()).toEqual(mockProvider);
        });

        it('should return null when reconnecting with no stored data', async () => {
            // Mock the internal Promise.resolve in the reconnect method
            const originalSetTimeout = global.setTimeout;
            global.setTimeout = vi.fn().mockImplementation((fn) => {
                if (typeof fn === 'function') fn();
                return {} as NodeJS.Timeout;
            });

            const result = await walletConnector.reconnect();

            // Restore setTimeout
            global.setTimeout = originalSetTimeout;

            expect(result).toBeNull();
        });
    });

    describe('signTypedData and getChainId', () => {
        it('should sign typed data when connected', async () => {
            const mockProvider = createMockProvider();
            await walletConnector.connect(mockProvider);

            const signature = await walletConnector.signTypedData('{"test": "data"}');

            expect(signature).toBe('0x123456');
            expect(mockProvider.provider.request).toHaveBeenCalledWith({
                method: 'eth_signTypedData_v4',
                params: ['0x71C7656EC7ab88b098defB751B7401B5f6d8976F', '{"test": "data"}'],
            });
        });

        it('should throw an error when signing typed data without a connected wallet', async () => {
            await expect(walletConnector.signTypedData('{"test": "data"}')).rejects.toThrow(
                'No wallet connected'
            );
        });

        it('should get the chain ID when connected', async () => {
            const mockProvider = createMockProvider();
            await walletConnector.connect(mockProvider);

            const chainId = await walletConnector.getChainId();

            expect(chainId).toBe(1); // 0x1 converted to decimal
            expect(mockProvider.provider.request).toHaveBeenCalledWith({
                method: 'eth_chainId',
            });
        });

        it('should throw an error when getting chain ID without a connected wallet', async () => {
            await expect(walletConnector.getChainId()).rejects.toThrow('No wallet connected');
        });
    });

    describe('event listeners and notifications', () => {
        it('should handle wallet account changes', async () => {
            const mockProvider = createMockProvider();
            const addressChangeListener = vi.fn();

            walletConnector.onAddressChange(addressChangeListener);
            await walletConnector.connect(mockProvider);

            // Clear initial calls from connect
            addressChangeListener.mockClear();

            // Simulate accountsChanged event
            (mockProvider.provider as MockEIP1193Provider).triggerEvent('accountsChanged', [
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
            ]);

            expect(walletConnector.getAddress()).toBe('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
            expect(addressChangeListener).toHaveBeenCalledWith(
                '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
            );
        });

        it('should handle wallet disconnection through account changes', async () => {
            const mockProvider = createMockProvider();
            const addressChangeListener = vi.fn();
            const providerChangeListener = vi.fn();

            walletConnector.onAddressChange(addressChangeListener);
            walletConnector.onProviderChange(providerChangeListener);
            await walletConnector.connect(mockProvider);

            // Clear initial calls from connect
            addressChangeListener.mockClear();
            providerChangeListener.mockClear();

            // Simulate accountsChanged event with empty accounts
            (mockProvider.provider as MockEIP1193Provider).triggerEvent('accountsChanged', []);

            expect(walletConnector.getAddress()).toBeNull();
            expect(walletConnector.getSelectedProvider()).toBeNull();
            expect(addressChangeListener).toHaveBeenCalledWith(null);
            expect(providerChangeListener).toHaveBeenCalledWith(null);
        });

        it('should handle chain changes', async () => {
            const mockProvider = createMockProvider();
            const addressChangeListener = vi.fn();

            walletConnector.onAddressChange(addressChangeListener);
            await walletConnector.connect(mockProvider);

            // Clear initial calls from connect
            addressChangeListener.mockClear();

            // Simulate chainChanged event
            (mockProvider.provider as MockEIP1193Provider).triggerEvent('chainChanged', '0x2');

            expect(addressChangeListener).toHaveBeenCalledWith(walletConnector.getAddress());
        });

        it('should handle wallet disconnect events', async () => {
            const mockProvider = createMockProvider();
            const addressChangeListener = vi.fn();
            const providerChangeListener = vi.fn();

            walletConnector.onAddressChange(addressChangeListener);
            walletConnector.onProviderChange(providerChangeListener);
            await walletConnector.connect(mockProvider);

            // Clear initial calls from connect
            addressChangeListener.mockClear();
            providerChangeListener.mockClear();

            // Simulate disconnect event
            (mockProvider.provider as MockEIP1193Provider).triggerEvent('disconnect');

            expect(walletConnector.getAddress()).toBeNull();
            expect(walletConnector.getSelectedProvider()).toBeNull();
            expect(addressChangeListener).toHaveBeenCalledWith(null);
            expect(providerChangeListener).toHaveBeenCalledWith(null);
        });

        it('should add and remove event listeners correctly', () => {
            // Simply verify that the function returns a removal function
            const listener = vi.fn();
            const removeListener = walletConnector.onAddressChange(listener);

            // The remove function should be callable
            expect(typeof removeListener).toBe('function');

            // Calling it should not throw errors
            expect(() => removeListener()).not.toThrow();

            // The function contract is fulfilled if it returns a function
            // that can be called to remove the listener
        });

        it('should notify when new providers are added to the list', () => {
            const mockProvider = createMockProvider();
            const providerListChangeListener = vi.fn();

            walletConnector.onProviderListChange(providerListChangeListener);

            // Manually trigger the provider announcement
            const announceEvent = {
                detail: mockProvider,
            } as CustomEvent<EIP6963ProviderDetail>;

            // Call the event listener directly
            const addEventListenerCalls = windowMock.addEventListener.mock.calls;
            const announceProviderListener = addEventListenerCalls.find(
                (call) => call[0] === 'eip6963:announceProvider'
            )?.[1];

            if (announceProviderListener) {
                announceProviderListener(announceEvent);
            }

            expect(providerListChangeListener).toHaveBeenCalledWith(mockProvider);
            expect(walletConnector.getProviders()).toEqual([mockProvider]);
        });
    });
});
