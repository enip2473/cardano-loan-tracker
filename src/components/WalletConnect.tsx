"use client"; // Required for components using hooks

import React from 'react';
import { CardanoWallet, useWallet, useAddress, useNetwork } from '@meshsdk/react';

const WalletConnect: React.FC = () => {
  const { connected, wallet } = useWallet();
  const address = useAddress();
  const network = useNetwork(); // 0 for testnet, 1 for mainnet

  return (
    <div style={{ margin: '10px 0' }}>
      <CardanoWallet /> {/* This component handles connection, disconnection, and wallet selection */}

      {connected && address && (
        <div style={{ marginTop: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
          <p><strong>Connected Wallet:</strong> {wallet?.name}</p>
          <p><strong>Address:</strong> <small>{address}</small></p>
          <p><strong>Network:</strong> {network === 0 ? 'Testnet' : network === 1 ? 'Mainnet' : 'Unknown'}</p>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;
