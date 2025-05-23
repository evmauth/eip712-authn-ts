import * as ethers from 'ethers';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EIP712AuthMessage, EIP712Domain } from '../../src/common/types.js';
import { AuthServer, createChallenge, verifyChallenge } from '../../src/server/auth-server.js';
import {
    InvalidJWTError,
    InvalidMessageError,
    InvalidSignatureError,
    SignatureMismatchError,
} from '../../src/server/errors.js';

vi.mock('ethers', async () => {
    const actual = await vi.importActual('ethers');
    return {
        ...(actual as object),
        isAddress: vi.fn(),
        verifyTypedData: vi.fn(),
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
            const challenge = authServer.createChallenge(walletAddress, networkId);

            // Verify the structure
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
                    challenge: expect.any(String),
                },
            });

            // Verify the JWT token contains the correct payload
            const decoded = jwt.verify(challenge.message.challenge, jwtSecret) as jwt.JwtPayload;
            expect(decoded.address).toBe(walletAddress);
            expect(decoded.exp).toBeDefined();
            expect(decoded.iat).toBeDefined();
        });

        it('should use custom expiresIn value when provided', () => {
            const expiresIn = 60;
            const challenge = authServer.createChallenge(walletAddress, networkId, expiresIn);

            const decoded = jwt.verify(challenge.message.challenge, jwtSecret) as jwt.JwtPayload;
            // Check that expiration is approximately 60 seconds from now
            const expectedExp = Math.floor(Date.now() / 1000) + expiresIn;
            expect(decoded.exp).toBeDefined();
            expect(Math.abs((decoded.exp as number) - expectedExp)).toBeLessThan(2); // Allow 2 second tolerance
        });
    });

    describe('verifyChallenge', () => {
        it('should verify challenge signature using the verifyChallenge function', () => {
            const token = jwt.sign({ address: walletAddress }, jwtSecret, { expiresIn: 30 });

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
                    challenge: token,
                },
            };
            const signed = 'signed-message';

            vi.mocked(ethers.isAddress).mockReturnValue(true);
            vi.mocked(ethers.verifyTypedData).mockReturnValue(walletAddress);

            const result = authServer.verifyChallenge(unsigned, signed);

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
        const challenge = createChallenge(walletAddress, jwtSecret, domain);

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
                challenge: expect.any(String),
            },
        });

        // Verify JWT content
        const decoded = jwt.verify(challenge.message.challenge, jwtSecret) as jwt.JwtPayload;
        expect(decoded.address).toBe(walletAddress);
    });

    it('should use custom expiresIn value when provided', () => {
        const expiresIn = 60;
        const challenge = createChallenge(walletAddress, jwtSecret, domain, expiresIn);

        const decoded = jwt.verify(challenge.message.challenge, jwtSecret) as jwt.JwtPayload;
        const expectedExp = Math.floor(Date.now() / 1000) + expiresIn;
        expect(decoded.exp).toBeDefined();
        expect(Math.abs((decoded.exp as number) - expectedExp)).toBeLessThan(2);
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
    const signed = 'signed-message';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return address when challenge is valid and addresses match', () => {
        const token = jwt.sign({ address: walletAddress }, jwtSecret, { expiresIn: 30 });
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
                challenge: token,
            },
        };

        vi.mocked(ethers.isAddress).mockReturnValue(true);
        vi.mocked(ethers.verifyTypedData).mockReturnValue(walletAddress);

        const result = verifyChallenge(unsigned, signed, jwtSecret);

        expect(ethers.isAddress).toHaveBeenCalledWith(walletAddress);
        expect(ethers.verifyTypedData).toHaveBeenCalledWith(
            unsigned.domain,
            { Authentication: unsigned.types.Authentication },
            unsigned.message,
            signed
        );
        expect(result).toBe(walletAddress);
    });

    it('should throw when message is invalid', () => {
        expect(() => verifyChallenge({} as EIP712AuthMessage, signed, jwtSecret)).toThrow(
            InvalidMessageError
        );
    });

    it('should throw when JWT verification fails', () => {
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
                challenge: 'invalid-jwt-token',
            },
        };

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(InvalidJWTError);
    });

    it('should throw when JWT payload is not a valid address', () => {
        const token = jwt.sign({ address: 'not-an-address' }, jwtSecret, { expiresIn: 30 });
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
                challenge: token,
            },
        };

        vi.mocked(ethers.isAddress).mockReturnValue(false);

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(InvalidJWTError);
    });

    it('should throw when verifyTypedData returns invalid address', () => {
        const token = jwt.sign({ address: walletAddress }, jwtSecret, { expiresIn: 30 });
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
                challenge: token,
            },
        };

        vi.mocked(ethers.isAddress).mockReturnValueOnce(true).mockReturnValueOnce(false);
        vi.mocked(ethers.verifyTypedData).mockReturnValue('invalid-address');

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(InvalidSignatureError);
    });

    it('should throw when addresses do not match', () => {
        const differentAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e';
        const token = jwt.sign({ address: walletAddress }, jwtSecret, { expiresIn: 30 });
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
                challenge: token,
            },
        };

        vi.mocked(ethers.isAddress).mockReturnValue(true);
        vi.mocked(ethers.verifyTypedData).mockReturnValue(differentAddress);

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(SignatureMismatchError);
    });

    it('should throw when JWT is expired', () => {
        // Create an expired token
        const token = jwt.sign({ address: walletAddress }, jwtSecret, { expiresIn: -1 });
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
                challenge: token,
            },
        };

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(InvalidJWTError);
    });

    it('should throw when JWT secret is wrong', () => {
        const token = jwt.sign({ address: walletAddress }, 'different-secret', { expiresIn: 30 });
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
                challenge: token,
            },
        };

        expect(() => verifyChallenge(unsigned, signed, jwtSecret)).toThrow(InvalidJWTError);
    });
});
