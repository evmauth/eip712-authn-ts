export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class InvalidJWTError extends AuthError {
    constructor(message = 'Invalid JWT token') {
        super(message);
        this.name = 'InvalidJWTError';
    }
}

export class InvalidMessageError extends AuthError {
    constructor(message = 'Invalid EIP-712 message') {
        super(message);
        this.name = 'InvalidMessageError';
    }
}

export class InvalidSignatureError extends AuthError {
    constructor(message = 'Invalid signature') {
        super(message);
        this.name = 'InvalidSignatureError';
    }
}

export class SignatureMismatchError extends AuthError {
    constructor(message = 'Signature does not match expected address') {
        super(message);
        this.name = 'SignatureMismatchError';
    }
}
