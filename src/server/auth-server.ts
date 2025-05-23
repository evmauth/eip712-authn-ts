import { isAddress, verifyTypedData } from 'ethers';
import jwt from 'jsonwebtoken';
import type { EIP712AuthMessage, EIP712Domain } from '../common/types.js';
import {
    InvalidJWTError,
    InvalidMessageError,
    InvalidSignatureError,
    SignatureMismatchError,
} from './errors.js';

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
        message: {
            challenge: token,
        },
    };
}

export function verifyChallenge(
    unsigned: EIP712AuthMessage,
    signed: string,
    jwtSecret: string
): string {
    if (!unsigned?.domain || !unsigned?.message) {
        throw new InvalidMessageError();
    }

    let payload: jwt.JwtPayload;
    try {
        payload = jwt.verify(unsigned.message.challenge, jwtSecret) as jwt.JwtPayload;
    } catch (_err) {
        throw new InvalidJWTError();
    }

    const expectedAddress = payload?.address;
    if (!expectedAddress || !isAddress(expectedAddress)) {
        throw new InvalidJWTError('JWT token does not contain a valid address');
    }

    let signerAddress: string;
    try {
        signerAddress = verifyTypedData(
            unsigned.domain,
            { Authentication: unsigned.types.Authentication },
            unsigned.message,
            signed
        );
    } catch (_err) {
        throw new InvalidSignatureError();
    }
    if (!signerAddress || !isAddress(signerAddress)) {
        throw new InvalidSignatureError('Signature verification did not return a valid address');
    }
    if (signerAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        throw new SignatureMismatchError();
    }

    return signerAddress;
}
