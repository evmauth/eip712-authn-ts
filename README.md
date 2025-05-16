# EVMAuth TypeScript EIP-712 Authentication

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/evmauth/eip712-authn-ts/test.yml?label=Tests)
![GitHub Repo stars](https://img.shields.io/github/stars/evmauth/eip712-authn-ts)

## Features

- **Sign In With Wallet**: Authenticate users via their Ethereum wallets using [EIP-712] typed data signatures
- **Multi Wallet Support**: First-class support for the [EIP-6963] wallet provider interface standard
- **Client Integration**: Simple client library for browser-based applications
- **Server Verification**: Robust server-side verification of signed messages
- **Full TypeScript Support**: Complete type safety with TypeScript interfaces for all components
- **Framework Agnostic**: Works with any JavaScript framework or vanilla JS
- **Minimal Dependencies**: Small footprint with few external dependencies
- **Comprehensive Tests**: Well-tested codebase with high test coverage
- **Secure Design**: Built with security best practices from the ground up

## Installation

```bash
npm install @evmauth/eip712-authn
```

## Quick Start

### Client-Side Implementation

```typescript
import { AuthClient, walletConnector } from '@evmauth/eip712-authn/client';

// Initialize the auth client with your API endpoints
const authClient = new AuthClient({
  challengeUrl: 'https://your-api.com/challenge',
  authUrl: 'https://your-api.com/auth',
});

// Connect to a wallet
async function connectWallet() {
  // Get available wallet providers (supports EIP-6963)
  const providers = walletConnector.getProviders();
  
  if (providers.length > 0) {
    // Connect to the first available provider
    const address = await walletConnector.connect(providers[0]);
    console.log(`Connected to wallet: ${address}`);
    return address;
  } else {
    console.error('No wallet providers found');
    return null;
  }
}

// Authenticate with the connected wallet
async function authenticate() {
  try {
    // One-step authentication
    const success = await authClient.authenticateWithWallet();
    
    if (success) {
      console.log('Authentication successful!');
      // User is now authenticated
    }
    
    return success;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

// Usage in an application
document.getElementById('connect-btn').addEventListener('click', async () => {
  await connectWallet();
});

document.getElementById('login-btn').addEventListener('click', async () => {
  await authenticate();
});
```

### Server-Side Implementation

```typescript
import { AuthServer } from '@evmauth/eip712-authn/server';
import express from 'express';

const app = express();
app.use(express.json());

// Initialize the auth server with a JWT secret and your domain details
const authServer = new AuthServer('your-jwt-secret', {
  name: 'Your App Name',
  version: '1',
  chainId: 1, // Ethereum Mainnet
});

// Challenge endpoint
app.get('/challenge', (req, res) => {
  const { address, networkId } = req.query;
  
  if (!address) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }
  
  // Create a challenge for the wallet address
  const challenge = authServer.createChallenge(address as string, 30); // expires in 30 seconds
  
  res.json(challenge);
});

// Authentication endpoint
app.post('/auth', (req, res) => {
  const signedMessage = req.headers.authorization?.replace('EIP712 ', '');
  const message = req.body;
  
  if (!signedMessage || !message) {
    return res.status(400).json({ error: 'Missing signature or message' });
  }
  
  // Verify the signed challenge
  const isValid = authServer.verifyChallenge(message, signedMessage);
  
  if (isValid) {
    // Create a session or JWT token for the authenticated user
    // ...
    
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid signature' });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## License

The **EVMAuth** TypeScript EIP-712 Authentication is released under the MIT License. See the [LICENSE](LICENSE) file for details.


[EIP-712]: https://eips.ethereum.org/EIPS/eip-712
[EIP-1193]: https://eips.ethereum.org/EIPS/eip-1193
[EIP-6963]: https://eips.ethereum.org/EIPS/eip-6963