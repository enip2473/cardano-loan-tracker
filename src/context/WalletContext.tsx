"use client"; // Required for React Context and hooks

import React, { createContext, useContext, ReactNode } from 'react';
import { MeshProvider, useWallet, useConnection, useNetwork } from '@meshsdk/react';

// Define the shape of our wallet context if we want to customize it
// For now, we can rely on the hooks provided by MeshProvider directly
// or create a more specific context if needed later.

// Create a simple wrapper for MeshProvider if no additional custom context logic is needed initially.
// This makes it easy to add custom logic later without changing every file.
const WalletProviderComponent: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <MeshProvider>{children}</MeshProvider>;
};

export { WalletProviderComponent as WalletProvider };

// Optionally, re-export hooks for easier access if preferred,
// or components can import them directly from @meshsdk/react.
export { useWallet, useConnection, useNetwork };

// Example of how to define a custom context if we wanted to add more state/functions:
/*
interface CustomWalletContextState {
  // Add any custom properties or functions here
  exampleCustomFunction: () => void;
}

const CustomWalletContext = createContext<CustomWalletContextState | undefined>(undefined);

export const useCustomWallet = () => {
  const context = useContext(CustomWalletContext);
  if (!context) {
    throw new Error('useCustomWallet must be used within a CustomWalletProvider');
  }
  return context;
};

export const CustomWalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const exampleCustomFunction = () => {
    console.log("Example custom function called");
  };

  return (
    <MeshProvider>
      <CustomWalletContext.Provider value={{ exampleCustomFunction }}>
        {children}
      </CustomWalletContext.Provider>
    </MeshProvider>
  );
};
*/
