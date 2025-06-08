// src/components/__tests__/CustomConnectWallet.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import CustomConnectWallet from '../CustomConnectWallet';
import '@testing-library/jest-dom';

// Mock Wagmi hooks
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockInjected = jest.fn(() => ({ id: 'injected', name: 'Injected' })); // Mock the injected connector

jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useConnect: jest.fn(),
  useDisconnect: jest.fn(),
}));

// Mock the specific connector import
jest.mock('wagmi/connectors', () => ({
  injected: () => mockInjected(),
}));


describe('CustomConnectWallet', () => {
  // Helper to set up mock return values for Wagmi hooks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setupMocks = (initialState: any) => {
    (require('wagmi').useAccount as jest.Mock).mockReturnValue(initialState.account);
    (require('wagmi').useConnect as jest.Mock).mockReturnValue(initialState.connect);
    (require('wagmi').useDisconnect as jest.Mock).mockReturnValue(initialState.disconnect);
  };

  describe('when wallet is not connected', () => {
    beforeEach(() => {
      setupMocks({
        account: { address: undefined, isConnected: false },
        connect: { connect: mockConnect, connectors: [mockInjected()] },
        disconnect: { disconnect: mockDisconnect },
      });
      render(<CustomConnectWallet />);
    });

    it('renders the "Connect Wallet" button', () => {
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
    });

    it('calls the connect function with injected connector when "Connect Wallet" button is clicked', () => {
      fireEvent.click(screen.getByText('Connect Wallet'));
      expect(mockConnect).toHaveBeenCalledTimes(1);
      expect(mockConnect).toHaveBeenCalledWith({ connector: mockInjected() });
    });
  });

  describe('when wallet is connected', () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    beforeEach(() => {
      setupMocks({
        account: { address: mockAddress, isConnected: true },
        connect: { connect: mockConnect, connectors: [mockInjected()] },
        disconnect: { disconnect: mockDisconnect },
      });
      render(<CustomConnectWallet />);
    });

    it('displays the truncated wallet address', () => {
      const expectedText = `Connected: ${mockAddress.substring(0, 6)}...${mockAddress.substring(mockAddress.length - 4)}`;
      expect(screen.getByText(expectedText)).toBeInTheDocument();
    });

    it('renders the "Disconnect" button', () => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('calls the disconnect function when "Disconnect" button is clicked', () => {
      fireEvent.click(screen.getByText('Disconnect'));
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });
  });
});
