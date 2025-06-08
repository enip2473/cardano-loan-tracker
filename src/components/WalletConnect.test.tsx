import React from 'react';
import { render, screen } from '@testing-library/react';
import WalletConnect from './WalletConnect'; // Adjust path as necessary
import { useWallet, useAddress, useNetwork } from '@meshsdk/react';

// Mock the @meshsdk/react hooks
jest.mock('@meshsdk/react', () => ({
  ...jest.requireActual('@meshsdk/react'), // Import and retain default exports
  useWallet: jest.fn(),
  useAddress: jest.fn(),
  useNetwork: jest.fn(),
  CardanoWallet: () => <div data-testid="cardano-wallet-mock">CardanoWalletMock</div>, // Mock CardanoWallet
}));

describe('WalletConnect Component', () => {
  const mockUseWallet = useWallet as jest.Mock;
  const mockUseAddress = useAddress as jest.Mock;
  const mockUseNetwork = useNetwork as jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    mockUseWallet.mockReset();
    mockUseAddress.mockReset();
    mockUseNetwork.mockReset();
  });

  test('renders CardanoWallet component', () => {
    mockUseWallet.mockReturnValue({ connected: false, wallet: null });
    mockUseAddress.mockReturnValue(null);
    mockUseNetwork.mockReturnValue(0);

    render(<WalletConnect />);
    expect(screen.getByTestId('cardano-wallet-mock')).toBeInTheDocument();
  });

  test('displays wallet information when connected', () => {
    const walletName = 'NamiTest';
    const testAddress = 'addr_test1qz2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3jcu5d8ps7zex2k2xt3uqxgjqnnj83ws8f4hw2tm8t6rgstdft76';
    const testNetwork = 0; // Testnet

    mockUseWallet.mockReturnValue({ connected: true, wallet: { name: walletName } });
    mockUseAddress.mockReturnValue(testAddress);
    mockUseNetwork.mockReturnValue(testNetwork);

    render(<WalletConnect />);

    expect(screen.getByText(`Connected Wallet: ${walletName}`)).toBeInTheDocument();
    expect(screen.getByText((content) => content.startsWith('Address:') && content.includes(testAddress))).toBeInTheDocument();
    expect(screen.getByText('Network: Testnet')).toBeInTheDocument();
  });

  test('does not display wallet information when not connected', () => {
    mockUseWallet.mockReturnValue({ connected: false, wallet: null });
    mockUseAddress.mockReturnValue(null);
    mockUseNetwork.mockReturnValue(0);

    render(<WalletConnect />);

    expect(screen.queryByText('Connected Wallet:')).not.toBeInTheDocument();
    expect(screen.queryByText('Address:')).not.toBeInTheDocument();
    expect(screen.queryByText('Network:')).not.toBeInTheDocument();
  });

  test('displays "Mainnet" for network ID 1', () => {
    mockUseWallet.mockReturnValue({ connected: true, wallet: { name: 'TestWallet' } });
    mockUseAddress.mockReturnValue('addr1test');
    mockUseNetwork.mockReturnValue(1); // Mainnet

    render(<WalletConnect />);
    expect(screen.getByText('Network: Mainnet')).toBeInTheDocument();
  });

   test('displays "Unknown" for other network IDs', () => {
    mockUseWallet.mockReturnValue({ connected: true, wallet: { name: 'TestWallet' } });
    mockUseAddress.mockReturnValue('addr1test');
    mockUseNetwork.mockReturnValue(2); // Unknown network

    render(<WalletConnect />);
    expect(screen.getByText('Network: Unknown')).toBeInTheDocument();
  });
});
