// app/wagmi-provider.tsx
"use client";

import { WagmiProvider, createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors'; // For MetaMask and similar browser wallets

// 1. Create a QueryClient
const queryClient = new QueryClient();

// 2. Create a wagmi config
export const config = createConfig({
  chains: [sepolia], // You can add more chains here, like mainnet
  connectors: [
    injected(), // This handles browser-injected wallets like MetaMask
    // You could also add WalletConnect, CoinbaseWallet, etc.
  ],
  transports: {
    [sepolia.id]: http(), // Use a public RPC provider for the Sepolia testnet
  },
});

// 3. Create the provider component
export function WagmiClientProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}