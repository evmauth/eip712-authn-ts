import { describe, expect, it } from 'vitest';
import * as client from '../../src/client/index.js';

describe('Client Module', () => {
    it('should export all methods', () => {
        expect(client).toHaveProperty('WalletConnector');
        expect(client).toHaveProperty('walletConnector');
        expect(client).toHaveProperty('AuthClient');
    });
});
