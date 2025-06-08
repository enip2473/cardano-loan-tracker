// components/CustomConnectWallet.tsx
"use client";

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors'; // Import the connector you configured

const styles = {
    button: {
        backgroundColor: '#007bff',
        color: 'white',
        padding: '10px 15px',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '1rem',
    },
    text: { marginLeft: '1rem', color: '#555' }
};

export default function CustomConnectWallet() {
    // wagmi hooks provide all the state and functions you need
    const { address, isConnected } = useAccount();
    const { connect } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected) {
        return (
            <div>
                <span style={styles.text}>
                    Connected: {`${address?.substring(0, 6)}...${address?.substring(address.length - 4)}`}
                </span>
                <button onClick={() => disconnect()} style={{...styles.button, marginLeft: '1rem', backgroundColor: '#dc3545'}}>
                    Disconnect
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => connect({ connector: injected() })} // Specify which connector to use
            style={styles.button}
        >
            Connect Wallet
        </button>
    );
}