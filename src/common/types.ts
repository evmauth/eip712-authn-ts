export interface EIP712Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
}

export interface EIP712AuthChallenge {
    challenge: string;
}

export interface EIP712AuthMessage {
    domain: EIP712Domain;
    types: {
        Authentication: Array<{ name: string; type: string }>;
        EIP712Domain: Array<{ name: string; type: string }>;
    };
    primaryType: string;
    auth: EIP712AuthChallenge;
}
