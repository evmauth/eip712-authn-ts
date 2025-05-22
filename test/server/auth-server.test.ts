import * as ethers from 'ethers';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EIP712AuthMessage, EIP712Domain } from '../../src/common/types.js';
import { AuthServer, createChallenge, verifyChallenge } from '../../src/server/auth-server.js';

// Mock ethers functions
vi.mock('ethers', async () => {
    const actual = await vi.importActual('ethers');
    return {
        ...(actual as object),
        isAddress: vi.fn(),
        verifyTypedData: vi.fn(),
    };
});

// Mock jwt functions
vi.mock('jsonwebtoken', async () => {
    const actual = await vi.importActual('jsonwebtoken');
    return {
        ...(actual as object),
        default: {
            sign: vi.fn(),
            verify: vi.fn(),
        },
    };
});

describe('AuthServer', () => {
    const jwtSecret = 'test-jwt-secret';
    const appName = 'Test App';
    const appVersion = '1';
    const networkId = 1;
    const domain: EIP712Domain = {
        name: appName,
        version: appVersion,
        chainId: networkId,
    };
    const walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

    let authServer: AuthServer;

    beforeEach(() => {
        authServer = new AuthServer({ jwtSecret, appName, appVersion });
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with provided jwtSecret and domain', () => {
            expect(authServer).toBeInstanceOf(AuthServer);
        });
    });

    describe('createChallenge', () => {
        it('should create a challenge using the createChallenge function', () => {
            const mockToken = 'mock-jwt-token';
            vi.mocked(jwt.sign).mockReturnValue(mockToken);

            const challenge = authServer.createChallenge(walletAddress, networkId);

            expect(jwt.sign).toHaveBeenCalledWith({ address: walletAddress }, jwtSecret, {
                expiresIn: 30,
            });
            expect(challenge).toEqual({
                domain,
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                    ],
                    Authentication: [{ name: 'challenge', type: 'string' }],
                },
                primaryType: 'Authentication',
                message: {
                    challenge: mockToken,
                },
            });
        });

        it('should use custom expiresIn value when provided', () => {
            const expiresIn = 60;
            authServer.createChallenge(walletAddress, networkId, expiresIn);

            expect(jwt.sign).toHaveBeenCalledWith({ address: walletAddress }, jwtSecret, {
                expiresIn,
            });
        });
    });

    describe('verifyChallenge', () => {
        it('should verify challenge signature using the verifyChallenge function', () => {
            const unsigned: EIP712AuthMessage = {
                domain,
                types: {
                    EIP712Domain: [
                        { name: 'name', type: 'string' },
                        { name: 'version', type: 'string' },
                        { name: 'chainId', type: 'uint256' },
                    ],
                    Authentication: [{ name: 'challenge', type: 'string' }],
                },
                primaryType: 'Authentication',
                message: {
                    challenge: 'mock-jwt-token',
                },
            };
            const signed = 'signed-message';

            vi.mocked(jwt.verify).mockReturnValue(walletAddress);
            vi.mocked(ethers.isAddress).mockReturnValue(true);
            vi.mocked(ethers.verifyTypedData).mockReturnValue(walletAddress);

            const result = authServer.verifyChallenge(unsigned, signed);

            expect(jwt.verify).toHaveBeenCalledWith(unsigned.message.challenge, jwtSecret);
            expect(ethers.verifyTypedData).toHaveBeenCalledWith(
                unsigned.domain,
                { Authentication: unsigned.types.Authentication },
                unsigned.message,
                signed
            );
            expect(result).toBe(walletAddress);
        });
    });
});

describe('createChallenge function', () => {
    const jwtSecret = 'test-jwt-secret';
    const appName = 'Test App';
    const appVersion = '1';
    const networkId = 1;
    const domain: EIP712Domain = {
        name: appName,
        version: appVersion,
        chainId: networkId,
    };
    const walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a challenge with correct structure', () => {
        const mockToken = 'mock-jwt-token';
        vi.mocked(jwt.sign).mockReturnValue(mockToken);

        const challenge = createChallenge(walletAddress, jwtSecret, domain);

        expect(jwt.sign).toHaveBeenCalledWith({ address: walletAddress }, jwtSecret, {
            expiresIn: 30,
        });
        expect(challenge).toEqual({
            domain,
            types: {
                EIP712Domain: [
                    { name: 'name', type: 'string' },
                    { name: 'version', type: 'string' },
                    { name: 'chainId', type: 'uint256' },
                ],
                Authentication: [{ name: 'challenge', type: 'string' }],
            },
            primaryType: 'Authentication',
            message: {
                challenge: mockToken,
            },
        });
    });

    it('should use custom expiresIn value when provided', () => {
        const expiresIn = 60;
        createChallenge(walletAddress, jwtSecret, domain, expiresIn);

        expect(jwt.sign).toHaveBeenCalledWith({ address: walletAddress }, jwtSecret, { expiresIn });
    });
});

describe('verifyChallenge function', () => {
    const jwtSecret = 'test-jwt-secret';
    const appName = 'Test App';
    const appVersion = '1';
    const networkId = 1;
    const domain: EIP712Domain = {
        name: appName,
        version: appVersion,
        chainId: networkId,
    };
    const walletAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';
    const unsigned: EIP712AuthMessage = {
        domain,
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
            ],
            Authentication: [{ name: 'challenge', type: 'string' }],
        },
        primaryType: 'Authentication',
        message: {
            challenge: 'mock-jwt-token',
        },
    };
    const signed = 'signed-message';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return address when challenge is valid and addresses match', () => {
        vi.mocked(jwt.verify).mockReturnValue(walletAddress);
        vi.mocked(ethers.isAddress).mockReturnValue(true);
        vi.mocked(ethers.verifyTypedData).mockReturnValue(walletAddress);

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(jwt.verify).toHaveBeenCalledWith(unsigned.message.challenge, jwtSecret);
        expect(ethers.isAddress).toHaveBeenCalledWith(walletAddress);
        expect(ethers.verifyTypedData).toHaveBeenCalledWith(
            unsigned.domain,
            { Authentication: unsigned.types.Authentication },
            unsigned.message,
            signed
        );
        expect(result).toBe(walletAddress);
    });

    it('should return null when message is invalid', () => {
        const result = verifyChallenge({} as EIP712AuthMessage, signed, jwtSecret);
        expect(result).toBe(null);
    });

    it('should return null when JWT verification fails', () => {
        // Looking at the implementation, we need to return undefined to simulate JWT verification failure
        vi.mocked(jwt.verify).mockReturnValue(undefined);

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(result).toBe(null);
    });

    it('should return null when JWT payload is not a valid address', () => {
        vi.mocked(jwt.verify).mockReturnValue('not-an-address');
        vi.mocked(ethers.isAddress).mockReturnValue(false);

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(result).toBe(null);
    });

    it('should return null when verifyTypedData returns invalid address', () => {
        vi.mocked(jwt.verify).mockReturnValue(walletAddress);
        vi.mocked(ethers.isAddress).mockReturnValueOnce(true).mockReturnValueOnce(false);
        vi.mocked(ethers.verifyTypedData).mockReturnValue('invalid-address');

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(result).toBe(null);
    });

    it('should return null when addresses do not match', () => {
        const differentAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        vi.mocked(jwt.verify).mockReturnValue(walletAddress);
        vi.mocked(ethers.isAddress).mockReturnValue(true);
        vi.mocked(ethers.verifyTypedData).mockReturnValue(differentAddress);

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(result).toBe(null);
    });
});
