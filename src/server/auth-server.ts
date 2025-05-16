import { isAddress, verifyTypedData } from 'ethers';
import jwt from 'jsonwebtoken';
import type { EIP712AuthMessage, EIP712Domain } from '../common/types.js';

export class AuthServer {
    private readonly jwtSecret: string;
    private readonly domain: EIP712Domain;

    constructor(jwtSecret: string, domain: EIP712Domain) {
        this.jwtSecret = jwtSecret;
        this.domain = domain;
    }

    createChallenge(address: string, expiresIn = 30): EIP712AuthMessage {
        return createChallenge(address, this.jwtSecret, this.domain, expiresIn);
    }

    verifyChallenge(message: EIP712AuthMessage, signedMessage: string): boolean {
        return verifyChallenge(message, signedMessage, this.jwtSecret);
    }
}

export function createChallenge(
    address: string,
    jwtSecret: string,
    domain: EIP712Domain,
    expiresIn = 30
): EIP712AuthMessage {
    const token = jwt.sign({ address }, jwtSecret, { expiresIn });

    return {
        domain,
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
            ],
            Authentication: [
                { name: 'jwt', type: 'string' },
                { name: 'walletAddress', type: 'address' },
            ],
        },
        primaryType: 'Authentication',
        auth: {
            challenge: token,
        },
    };
}

export function verifyChallenge(
    message: EIP712AuthMessage,
    signedMessage: string,
    jwtSecret: string
): boolean {
    if (!message?.domain || !message?.auth) {
        return false;
    }

    const expectedAddress: string = jwt.verify(message.auth.challenge, jwtSecret) as string;

    if (!expectedAddress || !isAddress(expectedAddress)) {
        return false;
    }

    const signerAddress = verifyTypedData(
        message.domain,
        { Authentication: message.types.Authentication },
        message.auth,
        signedMessage
    );

    if (!signerAddress || !isAddress(signerAddress)) {
        return false;
    }

    return signerAddress.toLowerCase() === expectedAddress.toLowerCase();
}
