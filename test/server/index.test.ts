import { describe, expect, it } from 'vitest';
import * as client from '../../src/server/index.js';

describe('Server Module', () => {
    it('should export all methods', () => {
        expect(client).toHaveProperty('AuthServer');
        expect(client).toHaveProperty('createChallenge');
        expect(client).toHaveProperty('verifyChallenge');
    });
});
