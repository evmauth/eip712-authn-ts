export { AuthServer, createChallenge, verifyChallenge } from './auth-server.js';
export type { AuthServerConfig } from './auth-server.js';
export type {
    EIP712Domain,
    EIP712AuthMessage,
    EIP712AuthChallenge,
} from '../common/types.js';
export type {
    AuthError,
    InvalidJWTError,
    InvalidMessageError,
    InvalidSignatureError,
    SignatureMismatchError,
} from './errors.js';
