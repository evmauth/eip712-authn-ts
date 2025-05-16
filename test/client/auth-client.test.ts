import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthClient } from '../../src/client/auth-client.js';
import * as walletConnectorModule from '../../src/client/wallet-connector.js';
import type { EIP712AuthMessage } from '../../src/common/types.js';

// Create a mock for the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Create mock wallet connector
vi.mock('../../src/client/wallet-connector.js', () => {
    return {
        walletConnector: {
            getAddress: vi.fn(),
            getChainId: vi.fn(),
            signTypedData: vi.fn(),
        },
    };
});

describe('AuthClient', () => {
    // Test configuration
    const config = {
        challengeUrl: 'https://api.example.com/challenge',
        authUrl: 'https://api.example.com/auth',
    };

    // Test data
    const walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    const chainId = 1;
    const mockChallenge: EIP712AuthMessage = {
        domain: {
            name: 'Test App',
            version: '1',
            chainId: 1,
            verifyingContract: '0x0000000000000000000000000000000000000000',
        },
        types: {
            Authentication: [
                { name: 'jwt', type: 'string' },
                { name: 'walletAddress', type: 'address' },
            ],
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
            ],
        },
        primaryType: 'Authentication',
        auth: {
            challenge: 'mock-challenge-token',
        },
    };

    const signedMessage = '0x123456789abcdef';

    let authClient: AuthClient;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Initialize the AuthClient
        authClient = new AuthClient(config);

        // Set up wallet connector mock methods
        vi.mocked(walletConnectorModule.walletConnector.getAddress).mockReturnValue(walletAddress);
        vi.mocked(walletConnectorModule.walletConnector.getChainId).mockResolvedValue(chainId);
        vi.mocked(walletConnectorModule.walletConnector.signTypedData).mockResolvedValue(
            signedMessage
        );
    });

    describe('requestChallenge', () => {
        it('should fetch a challenge from the server', async () => {
            // Mock successful response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockChallenge),
            });

            const challenge = await authClient.requestChallenge();

            // Verify fetch was called with correct parameters
            expect(mockFetch).toHaveBeenCalledWith(
                `${config.challengeUrl}?address=${walletAddress}&networkId=${chainId}`,
                {
                    method: 'GET',
                }
            );

            // Verify the returned challenge matches the mock
            expect(challenge).toEqual(mockChallenge);
        });

        it('should throw an error if no wallet is connected', async () => {
            // Mock wallet connector to return null address
            vi.mocked(walletConnectorModule.walletConnector.getAddress).mockReturnValueOnce(null);

            await expect(authClient.requestChallenge()).rejects.toThrow('No wallet connected');
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should throw an error if the server response is not ok', async () => {
            // Mock failed server response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                text: () => Promise.resolve('Server error'),
            });

            await expect(authClient.requestChallenge()).rejects.toThrow(
                'Failed to fetch authentication challenge: Server error'
            );
        });
    });

    describe('signChallenge', () => {
        it('should sign a challenge using the wallet connector', async () => {
            const result = await authClient.signChallenge(mockChallenge);

            // Verify wallet connector was called with stringified challenge
            expect(walletConnectorModule.walletConnector.signTypedData).toHaveBeenCalledWith(
                JSON.stringify(mockChallenge)
            );

            // Verify the returned signature matches the mock
            expect(result).toBe(signedMessage);
        });

        it('should throw an error if no wallet is connected', async () => {
            // Mock wallet connector to return null address
            vi.mocked(walletConnectorModule.walletConnector.getAddress).mockReturnValueOnce(null);

            await expect(authClient.signChallenge(mockChallenge)).rejects.toThrow(
                'No wallet connected'
            );
            expect(walletConnectorModule.walletConnector.signTypedData).not.toHaveBeenCalled();
        });
    });

    describe('authenticate', () => {
        it('should send the signed challenge to the server', async () => {
            // Mock successful response
            mockFetch.mockResolvedValueOnce({
                ok: true,
            });

            const result = await authClient.authenticate(mockChallenge, signedMessage);

            // Verify fetch was called with correct parameters
            expect(mockFetch).toHaveBeenCalledWith(config.authUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `EIP712 ${signedMessage}`,
                },
                body: JSON.stringify(mockChallenge),
            });

            // Verify successful authentication
            expect(result).toBe(true);
        });

        it('should throw an error if the server response is not ok', async () => {
            // Mock failed server response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                text: () => Promise.resolve('Authentication failed on server'),
            });

            await expect(authClient.authenticate(mockChallenge, signedMessage)).rejects.toThrow(
                'Authentication failed: Authentication failed on server'
            );
        });
    });

    describe('authenticateWithWallet', () => {
        it('should complete the full authentication flow', async () => {
            // Mock requestChallenge
            const requestChallengeSpy = vi.spyOn(authClient, 'requestChallenge');
            requestChallengeSpy.mockResolvedValueOnce(mockChallenge);

            // Mock signChallenge
            const signChallengeSpy = vi.spyOn(authClient, 'signChallenge');
            signChallengeSpy.mockResolvedValueOnce(signedMessage);

            // Mock authenticate
            const authenticateSpy = vi.spyOn(authClient, 'authenticate');
            authenticateSpy.mockResolvedValueOnce(true);

            const result = await authClient.authenticateWithWallet();

            // Verify all methods were called with correct parameters
            expect(requestChallengeSpy).toHaveBeenCalled();
            expect(signChallengeSpy).toHaveBeenCalledWith(mockChallenge);
            expect(authenticateSpy).toHaveBeenCalledWith(mockChallenge, signedMessage);

            // Verify successful authentication
            expect(result).toBe(true);
        });

        it('should propagate errors from the request challenge step', async () => {
            // Mock requestChallenge to throw an error
            const requestChallengeSpy = vi.spyOn(authClient, 'requestChallenge');
            requestChallengeSpy.mockRejectedValueOnce(new Error('Challenge request failed'));

            await expect(authClient.authenticateWithWallet()).rejects.toThrow(
                'Challenge request failed'
            );
        });

        it('should propagate errors from the sign challenge step', async () => {
            // Mock requestChallenge
            const requestChallengeSpy = vi.spyOn(authClient, 'requestChallenge');
            requestChallengeSpy.mockResolvedValueOnce(mockChallenge);

            // Mock signChallenge to throw an error
            const signChallengeSpy = vi.spyOn(authClient, 'signChallenge');
            signChallengeSpy.mockRejectedValueOnce(new Error('User rejected signature'));

            await expect(authClient.authenticateWithWallet()).rejects.toThrow(
                'User rejected signature'
            );
        });

        it('should propagate errors from the authenticate step', async () => {
            // Mock requestChallenge
            const requestChallengeSpy = vi.spyOn(authClient, 'requestChallenge');
            requestChallengeSpy.mockResolvedValueOnce(mockChallenge);

            // Mock signChallenge
            const signChallengeSpy = vi.spyOn(authClient, 'signChallenge');
            signChallengeSpy.mockResolvedValueOnce(signedMessage);

            // Mock authenticate to throw an error
            const authenticateSpy = vi.spyOn(authClient, 'authenticate');
            authenticateSpy.mockRejectedValueOnce(new Error('Authentication failed'));

            await expect(authClient.authenticateWithWallet()).rejects.toThrow(
                'Authentication failed'
            );
        });
    });
});
