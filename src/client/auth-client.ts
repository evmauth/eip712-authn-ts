import type { EIP712AuthMessage } from '../common/types.js';
import { walletConnector } from './wallet-connector.js';

export interface AuthClientConfig {
    challengeUrl: string | URL; // GET request with `address` and `networkId` as query params
    authUrl: string | URL; // POST request with signed challenge in `Authorization` header, unsigned challenge in body
}

export class AuthClient {
    constructor(private config: AuthClientConfig) {
        this.config = config;
    }

    /**
     * Request an authentication challenge from the server
     */
    public async requestChallenge(): Promise<EIP712AuthMessage> {
        const address = walletConnector.getAddress();
        if (!address) {
            throw new Error('No wallet connected');
        }

        const chainId = await walletConnector.getChainId();
        const params = new URLSearchParams();
        params.append('address', address);
        params.append('networkId', chainId.toString());

        const response = await fetch(`${this.config.challengeUrl}?${params}`, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch authentication challenge: ${errorText}`);
        }

        // Assuming the challenge is returned as a JSON object
        return response.json();
    }

    /**
     * Sign a challenge with the connected wallet
     */
    public async signChallenge(message: EIP712AuthMessage): Promise<string> {
        const address = walletConnector.getAddress();
        if (!address) {
            throw new Error('No wallet connected');
        }

        // Convert the challenge to a string for signing
        const challengeString = JSON.stringify(message);

        // Sign the challenge
        return await walletConnector.signTypedData(challengeString);
    }

    /**
     * Submit a signed challenge to authenticate
     */
    public async authenticate(message: EIP712AuthMessage, signedMessage: string): Promise<boolean> {
        const response = await fetch(this.config.authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `EIP712 ${signedMessage}`,
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Authentication failed: ${errorText}`);
        }

        return true;
    }

    /**
     * Complete authentication flow in one step
     */
    public async authenticateWithWallet(): Promise<boolean> {
        const challenge = await this.requestChallenge();
        const signedChallenge = await this.signChallenge(challenge);
        return this.authenticate(challenge, signedChallenge);
    }
}
