// src/app/create-loan/__tests__/page.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateLoanPage from '../page';
import '@testing-library/jest-dom';
import { ethers } from 'ethers';

// --- Mocks ---
const mockPush = jest.fn();
const mockUseRouter = jest.fn(() => ({ push: mockPush }));

const mockSigner = {
  getAddress: jest.fn().mockResolvedValue('0xLenderAddress'),
  // Add other signer methods if CreateLoanPage directly uses them, though typically ContractFactory handles it
};
const mockUseEthersSigner = jest.fn(() => mockSigner);

const mockUseAccount = jest.fn();

const mockLoanContractInstance = {
  waitForDeployment: jest.fn().mockResolvedValue(null),
  getAddress: jest.fn().mockResolvedValue('0xContractAddress'),
  deploymentTransaction: jest.fn(() => ({ hash: '0xTxHash' })),
};
const mockContractFactoryDeploy = jest.fn().mockResolvedValue(mockLoanContractInstance);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockContractFactory = jest.fn<any, any[]>(() => ({ // Use any[] for constructor arguments
 deploy: mockContractFactoryDeploy,
}));


const mockSupabaseInsert = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseFrom = jest.fn(() => ({ insert: mockSupabaseInsert }));
const mockSupabase = { from: mockSupabaseFrom };

jest.mock('next/navigation', () => ({
  useRouter: () => mockUseRouter(),
}));

jest.mock('../../../hooks/useEthersSigner', () => ({
  useEthersSigner: () => mockUseEthersSigner(),
}));

jest.mock('wagmi', () => ({
  useAccount: () => mockUseAccount(),
}));

// Mock ethers.ContractFactory
jest.mock('ethers', () => {
  const originalEthers = jest.requireActual('ethers');
  return {
    ...originalEthers,
    ContractFactory: function(...args: unknown[]) { // Use unknown[] for constructor arguments
        return mockContractFactory(...args);
    },
    isAddress: jest.fn((address) => /^0x[a-fA-F0-9]{40}$/.test(address)), // Basic mock
    parseEther: jest.fn((value) => originalEthers.parseEther(value)), // Use actual for this utility
  };
});


jest.mock('../../../lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

// Mock LoanAgreementArtifact
jest.mock('../../../lib/contracts/LoanAgreement.json', () => ({
  abi: [{ type: 'constructor', inputs: [] }, { type: 'function', name: 'deploy' }], // Minimal ABI
  bytecode: '0xbytecode',
}));


describe('CreateLoanPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock setup for a connected wallet
    mockUseAccount.mockReturnValue({
      address: '0xLenderAddress',
      isConnected: true,
    });
    mockUseEthersSigner.mockReturnValue(mockSigner);
    mockUseRouter.mockReturnValue({ push: mockPush });

    // Reset ethers.ContractFactory mock specifically if needed for its constructor or methods
    mockContractFactory.mockClear();
    mockContractFactoryDeploy.mockClear();
    mockLoanContractInstance.waitForDeployment.mockClear();
    mockLoanContractInstance.getAddress.mockClear();
    mockLoanContractInstance.deploymentTransaction.mockClear();
    mockSupabaseInsert.mockClear();
    (ethers.isAddress as jest.Mock).mockImplementation((address) => /^0x[a-fA-F0-9]{40}$/.test(address));

  });

  it('renders the create loan form', () => {
    render(<CreateLoanPage />);
    expect(screen.getByRole('heading', { name: /create new loan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/borrower's ethereum address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/principal amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/interest amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create loan contract/i })).toBeInTheDocument();
  });

  it('shows "Connect Wallet to Continue" if wallet is not connected', () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    render(<CreateLoanPage />);
    expect(screen.getByRole('button', { name: /connect wallet to continue/i })).toBeDisabled();
  });

  it('allows form input', () => {
    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: '0xBorrowerAddress' } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText(/interest amount/i), { target: { value: '0.1' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test loan description' } });

    expect(screen.getByLabelText(/borrower's ethereum address/i)).toHaveValue('0xBorrowerAddress');
    expect(screen.getByLabelText(/principal amount/i)).toHaveValue(1.5);
    expect(screen.getByLabelText(/interest amount/i)).toHaveValue(0.1);
    expect(screen.getByLabelText(/description/i)).toHaveValue('Test loan description');
  });

  it('submits the form, deploys contract, and saves to Supabase on valid input', async () => {
    (ethers.isAddress as jest.Mock).mockReturnValue(true); // Ensure borrower address is seen as valid
    const validBorrowerAddress = '0xValidBorrowerAddress123456789012345'; // 40 hex chars

    render(<CreateLoanPage />);

    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: validBorrowerAddress } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/interest amount/i), { target: { value: '0.05' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Successful loan' } });

    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(mockContractFactoryDeploy).toHaveBeenCalledTimes(1);
    });

    // Verify deployment arguments (example for principal and interest)
    // The actual arguments depend on LoanAgreement.json constructor and how ethers.ContractFactory is called
    expect(mockContractFactoryDeploy).toHaveBeenCalledWith(
        validBorrowerAddress, // _borrower
        ethers.parseEther('0.05'), // _interest_amount
        604800, // _acceptance_period_seconds (default in component)
        { value: ethers.parseEther('1') } // principal sent with tx
    );

    expect(mockLoanContractInstance.waitForDeployment).toHaveBeenCalledTimes(1);
    expect(mockLoanContractInstance.getAddress).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
    });
    expect(mockSupabaseInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        lender_address: '0xLenderAddress',
        borrower_address: validBorrowerAddress,
        amount: 1,
        interest: 0.05,
        status: 'pending_borrower_acceptance',
        description: 'Successful loan',
        contract_address: '0xContractAddress',
        contract_tx_hash: '0xTxHash',
        network: 'sepolia',
      }),
    ]);

    expect(screen.getByRole('button', { name: /deploying to sepolia.../i})).toBeDisabled();

    await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith("Loan contract deployed successfully!");
    });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows error if borrower address is invalid', async () => {
    (ethers.isAddress as jest.Mock).mockReturnValue(false);
    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: 'invalid-address' } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(screen.getByText(/the borrower address is not a valid ethereum address/i)).toBeInTheDocument();
    });
    expect(mockContractFactoryDeploy).not.toHaveBeenCalled();
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('shows error if borrower address is same as lender', async () => {
    const lenderAddress = '0xLenderAddressSameAsBorrower123456789';
    mockUseAccount.mockReturnValue({ address: lenderAddress, isConnected: true });
    (ethers.isAddress as jest.Mock).mockReturnValue(true); // Ensure borrower address is seen as valid

    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: lenderAddress } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(screen.getByText(/borrower address cannot be the same as your own/i)).toBeInTheDocument();
    });
    expect(mockContractFactoryDeploy).not.toHaveBeenCalled();
  });


  it('shows error if principal amount is missing', async () => {
    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: '0xValidBorrowerAddress123456789012345' } });
    // Principal amount is left empty
    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(screen.getByText(/please provide the borrower's eth address and a loan amount/i)).toBeInTheDocument();
    });
    expect(mockContractFactoryDeploy).not.toHaveBeenCalled();
  });

  it('handles contract deployment failure', async () => {
    (ethers.isAddress as jest.Mock).mockReturnValue(true);
    mockContractFactoryDeploy.mockRejectedValueOnce(new Error('Blockchain boom!'));

    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: '0xAnotherBorrower12345678901234567890' } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to deploy contract: blockchain boom!/i)).toBeInTheDocument();
    });
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  it('handles Supabase insert failure after successful deployment', async () => {
    (ethers.isAddress as jest.Mock).mockReturnValue(true);
    mockSupabaseInsert.mockResolvedValueOnce({ error: new Error('Supabase boom!') });

    render(<CreateLoanPage />);
    fireEvent.change(screen.getByLabelText(/borrower's ethereum address/i), { target: { value: '0xYetAnotherBorrower123456789012345' } });
    fireEvent.change(screen.getByLabelText(/principal amount/i), { target: { value: '3' } });

    fireEvent.click(screen.getByRole('button', { name: /create loan contract/i }));

    await waitFor(() => {
      expect(mockContractFactoryDeploy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.getByText(/failed to deploy contract: error: supabase boom!/i)).toBeInTheDocument(); // Error message includes "Error: " prefix due to Supabase client
    });
    // Check that the button text reverts from "Deploying..."
    expect(screen.getByRole('button', { name: /create loan contract/i})).not.toBeDisabled();
  });

});

// Mock window.alert
global.alert = jest.fn();
