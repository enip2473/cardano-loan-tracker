# Wallet Integration with Mesh SDK

This document outlines the steps taken to integrate Cardano wallet functionalities into the application using the Mesh SDK.

## 1. Installation of Mesh SDK

The Mesh SDK provides tools and components to interact with Cardano wallets and the blockchain.

-   **Dependencies Added:**
    The following packages were added to the project's `package.json` using yarn:
    ```bash
    yarn add @meshsdk/core @meshsdk/react
    ```
    *Note: This step required upgrading the Node.js version in the development environment to v20.x due to a dependency requirement (`@utxorpc/spec`). The upgrade was performed using NodeSource repositories for Debian/Ubuntu.*

## 2. Wallet Context Setup (`WalletContext.tsx`)

A React Context was set up to provide wallet state and functions throughout the application.

-   **File Created:** `src/context/WalletContext.tsx`
-   **Implementation Details:**
    -   The `WalletContext.tsx` file uses `MeshProvider` from `@meshsdk/react` as the core provider.
    -   A wrapper component `WalletProviderComponent` (exported as `WalletProvider`) was created. This component currently just renders the `<MeshProvider>`. This structure allows for easier future customization of the wallet context if needed, without modifying every part of the app that uses it.
    -   Commonly used hooks like `useWallet`, `useConnection`, and `useNetwork` from `@meshsdk/react` are re-exported for convenience, though components can also import them directly.

    ```typescript
    // src/context/WalletContext.tsx
    "use client";

    import React, { ReactNode } from 'react';
    import { MeshProvider, useWallet, useConnection, useNetwork } from '@meshsdk/react';

    const WalletProviderComponent: React.FC<{ children: ReactNode }> = ({ children }) => {
      return <MeshProvider>{children}</MeshProvider>;
    };

    export { WalletProviderComponent as WalletProvider };
    export { useWallet, useConnection, useNetwork };
    ```

## 3. Updating Application Layout (`layout.tsx`)

The `WalletProvider` was added to the main application layout to make the wallet context available to all components.

-   **File Modified:** `src/app/layout.tsx`
-   **Changes:**
    -   The `WalletProvider` was imported from `src/context/WalletContext.tsx`.
    -   It was used to wrap the existing `AuthProvider` and the rest of the application content, ensuring that wallet functionalities are accessible globally.

    ```typescript
    // src/app/layout.tsx (snippet)
    import { WalletProvider } from "../context/WalletContext";
    // ... other imports

    export default function RootLayout({ children }) {
      return (
        <html lang="en">
          <body>
            <WalletProvider> {/* WalletProvider wraps other providers and content */}
              <AuthProvider>
                <Navbar />
                <main>{children}</main>
              </AuthProvider>
            </WalletProvider>
          </body>
        </html>
      );
    }
    ```

## 4. Wallet Connection UI (`WalletConnect.tsx`)

A dedicated component was created to handle wallet connections and display wallet information.

-   **File Created:** `src/components/WalletConnect.tsx`
-   **Implementation Details:**
    -   The component uses the `CardanoWallet` component from `@meshsdk/react`, which provides a pre-built UI for selecting and connecting to various Cardano wallet extensions (e.g., Nami, Eternl, Lace).
    -   It also uses the `useWallet`, `useAddress`, and `useNetwork` hooks to display information about the connected wallet, such as its name, address, and current network (Testnet/Mainnet).

    ```typescript
    // src/components/WalletConnect.tsx
    "use client";

    import React from 'react';
    import { CardanoWallet, useWallet, useAddress, useNetwork } from '@meshsdk/react';

    const WalletConnect: React.FC = () => {
      const { connected, wallet } = useWallet();
      const address = useAddress();
      const network = useNetwork(); // 0 for testnet, 1 for mainnet

      return (
        <div>
          <CardanoWallet />
          {connected && address && (
            <div style={{ marginTop: '10px' }}>
              <p><strong>Connected:</strong> {wallet?.name}</p>
              <p><strong>Address:</strong> {address}</p>
              <p><strong>Network:</strong> {network === 0 ? 'Testnet' : 'Mainnet'}</p>
            </div>
          )}
        </div>
      );
    };

    export default WalletConnect;
    ```

## 5. Integrating `WalletConnect` Component

The `WalletConnect` component was added to the application's navigation bar for easy user access.

-   **File Modified:** `src/components/Navbar.tsx`
-   **Changes:**
    -   The `WalletConnect` component was imported into `Navbar.tsx`.
    -   It was rendered within the main navigation links section, making it consistently visible.

    ```typescript
    // src/components/Navbar.tsx (snippet)
    import WalletConnect from './WalletConnect';
    // ... other imports

    export default function Navbar() {
      // ... existing navbar logic
      return (
        <nav>
          {/* ... other navbar elements ... */}
          <div style={navStyles.links}>
            {/* ... other links ... */}
            <WalletConnect /> {/* WalletConnect component added here */}
          </div>
        </nav>
      );
    }
    ```

This setup provides a foundational wallet integration, allowing users to connect their Cardano wallets and enabling the application to access wallet information for subsequent blockchain interactions.
