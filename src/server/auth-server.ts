import { isAddress, verifyTypedData } from 'ethers';
import jwt from 'jsonwebtoken';
import type { EIP712AuthMessage, EIP712Domain } from '../common/types.js';

export interface AuthServerConfig {
    jwtSecret: string;
    appName: string;
    appVersion: string;
}

export class AuthServer {
    constructor(private config: AuthServerConfig) {
        this.config = config;
    }

    createChallenge(address: string, networkId: number, expiresIn = 30): EIP712AuthMessage {
        return createChallenge(
            address,
            this.config.jwtSecret,
            {
                name: this.config.appName,
                version: this.config.appVersion,
                chainId: networkId,
            },
            expiresIn
        );
    }

    verifyChallenge(message: EIP712AuthMessage, signedMessage: string): string | null {
        return verifyChallenge(message, signedMessage, this.config.jwtSecret);
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
            Authentication: [{ name: 'challenge', type: 'string' }],
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
): string | null {
    if (!message?.domain || !message?.auth) {
        return null;
    }

    const expectedAddress: string = jwt.verify(message.auth.challenge, jwtSecret) as string;

    if (!expectedAddress || !isAddress(expectedAddress)) {
        return null;
    }

    const signerAddress = verifyTypedData(
        message.domain,
        { Authentication: message.types.Authentication },
        message.auth,
        signedMessage
    );

    if (!signerAddress || !isAddress(signerAddress)) {
        return null;
    }

    if (signerAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        return null;
    }

    return signerAddress;
}
