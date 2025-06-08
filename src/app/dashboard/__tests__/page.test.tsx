// src/app/dashboard/__tests__/page.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import DashboardPage from '../page';
import '@testing-library/jest-dom';
import { ethers } from 'ethers';

// --- Mocks ---
const mockPush = jest.fn();
const mockUseRouter = jest.fn(() => ({ push: mockPush }));

const mockSigner = {
  getAddress: jest.fn().mockResolvedValue('0xUserAddress'),
  // Add other signer methods if DashboardPage directly uses them for contract calls
};
const mockUseEthersSigner = jest.fn(() => mockSigner);
const mockUseAccount = jest.fn();

const mockContractInstance = {
  accept: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue(null) }),
  repay: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue(null) }),
  cancel: jest.fn().mockResolvedValue({ wait: jest.fn().mockResolvedValue(null) }),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEthersContract = jest.fn<any, any[]>(() => mockContractInstance);


const mockSupabaseSelect = jest.fn();
const mockSupabaseUpdate = jest.fn().mockResolvedValue({ error: null });
const mockSupabaseEq = jest.fn().mockReturnThis(); // To chain .eq after .update or .select
const mockSupabaseOr = jest.fn().mockReturnThis(); // To chain .or after .select

const mockSupabaseFrom = jest.fn(() => ({
  select: mockSupabaseSelect,
  update: mockSupabaseUpdate,
}));
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

jest.mock('ethers', () => {
  const originalEthers = jest.requireActual('ethers');
  return {
    ...originalEthers,
    Contract: function(...args: unknown[]) { // Use unknown[] for constructor arguments
      return mockEthersContract(...args);
    },
    parseEther: jest.fn((value) => originalEthers.parseEther(value)), // Use actual
  };
});

jest.mock('../../../lib/supabaseClient', () => ({
  supabase: mockSupabase,
}));

jest.mock('../../../lib/contracts/LoanAgreement.json', () => ({
  abi: [{ type: 'function', name: 'accept' }, { type: 'function', name: 'repay' }, { type: 'function', name: 'cancel' }], // Minimal ABI
  bytecode: '0xbytecode',
}));

// Mock window.alert
global.alert = jest.fn();

// Helper function to create mock loan data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createMockLoan = (overrides: Partial<any>): any => ({
  id: `id-${Math.random().toString(36).substr(2, 9)}`,
  created_at: new Date().toISOString(),
  lender_address: '0xLenderAddress',
  borrower_address: '0xBorrowerAddress',
  amount: 1,
  interest: 0.1,
  status: 'pending_borrower_acceptance',
  description: 'Test Loan',
  contract_address: `0xContractAddress-${Math.random().toString(36).substr(2, 9)}`,
  ...overrides,
});


describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAccount.mockReturnValue({ address: '0xUserAddress', isConnected: true });
    mockUseEthersSigner.mockReturnValue(mockSigner);
    mockUseRouter.mockReturnValue({ push: mockPush });

    // Setup chainable Supabase mocks
    mockSupabaseSelect.mockImplementation(() => ({
        or: mockSupabaseOr.mockReturnThis(),
        eq: mockSupabaseEq.mockReturnThis(), // if .eq is used after .select directly
    }));
    mockSupabaseUpdate.mockImplementation(() => ({
        eq: mockSupabaseEq.mockResolvedValue({ error: null }), // .update().eq()
    }));

    // Default Supabase select to return empty array
    mockSupabaseOr.mockResolvedValue({ data: [], error: null });
    mockSupabaseEq.mockResolvedValue({ data: [], error: null }); // For cases where .eq is terminal

  });

  it('shows loading state initially', () => {
    mockSupabaseOr.mockReturnValueOnce(new Promise(() => {})); // Keep it pending
    render(<DashboardPage />);
    expect(screen.getByText(/loading dashboard.../i)).toBeInTheDocument();
  });

  it('shows "connect wallet" message if not connected', async () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/please connect your wallet to view your loans/i)).toBeInTheDocument();
    });
  });

  it('fetches and displays lent and borrowed loans for connected user', async () => {
    const userAddress = '0xUserAddress';
    const lentLoan = createMockLoan({ lender_address: userAddress, borrower_address: '0xOtherBorrower', description: 'Lent out' });
    const borrowedLoan = createMockLoan({ lender_address: '0xOtherLender', borrower_address: userAddress, description: 'Borrowed in' });

    mockUseAccount.mockReturnValue({ address: userAddress, isConnected: true });
    mockSupabaseOr.mockResolvedValue({ data: [lentLoan, borrowedLoan], error: null });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/lent to: 0xOther...ower/i)).toBeInTheDocument();
      expect(screen.getByText('Lent out')).toBeInTheDocument();
      expect(screen.getByText(/borrowed from: 0xOther...der/i)).toBeInTheDocument();
      expect(screen.getByText('Borrowed in')).toBeInTheDocument();
    });
  });

  it('shows "no loans" messages if user has no loans', async () => {
    mockSupabaseOr.mockResolvedValue({ data: [], error: null });
    render(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText(/you haven't lent out any money yet/i)).toBeInTheDocument();
      expect(screen.getByText(/you don't have any borrowed loans/i)).toBeInTheDocument();
    });
  });

  describe('Loan Actions', () => {
    const lenderUser = '0xTestLender';
    const borrowerUser = '0xTestBorrower';

    it('allows lender to cancel a pending loan', async () => {
      const loan = createMockLoan({ lender_address: lenderUser, borrower_address: borrowerUser, status: 'pending_borrower_acceptance' });
      mockUseAccount.mockReturnValue({ address: lenderUser, isConnected: true });
      mockSupabaseOr.mockResolvedValue({ data: [loan], error: null });

      render(<DashboardPage />);

      const cancelButton = await screen.findByRole('button', { name: /cancel loan/i });
      fireEvent.click(cancelButton);

      expect(screen.getByRole('button', { name: /canceling.../i })).toBeDisabled();

      await waitFor(() => expect(mockEthersContract).toHaveBeenCalledWith(loan.contract_address, expect.any(Array), mockSigner));
      await waitFor(() => expect(mockContractInstance.cancel).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith({ status: 'canceled' }));
      await waitFor(() => expect(mockSupabaseEq).toHaveBeenCalledWith('id', loan.id));
      await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Loan canceled successfully!"));

      // Check if UI updates
      await waitFor(() => expect(screen.getByText(/status: canceled/i)).toBeInTheDocument());
    });

    it('allows borrower to accept a pending loan', async () => {
      const loan = createMockLoan({ lender_address: lenderUser, borrower_address: borrowerUser, status: 'pending_borrower_acceptance' });
      mockUseAccount.mockReturnValue({ address: borrowerUser, isConnected: true });
      mockSupabaseOr.mockResolvedValue({ data: [loan], error: null });

      render(<DashboardPage />);

      const acceptButton = await screen.findByRole('button', { name: /accept loan/i });
      fireEvent.click(acceptButton);

      expect(screen.getByRole('button', { name: /accepting.../i })).toBeDisabled();

      await waitFor(() => expect(mockContractInstance.accept).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith({ status: 'active' }));
      await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Loan accepted successfully!"));
      await waitFor(() => expect(screen.getByText(/status: active/i)).toBeInTheDocument());
    });

    it('allows borrower to repay an active loan', async () => {
        const loan = createMockLoan({
            lender_address: lenderUser,
            borrower_address: borrowerUser,
            status: 'active',
            amount: 1.2, // Using a different amount to test parseEther
            interest: 0.3
        });
        mockUseAccount.mockReturnValue({ address: borrowerUser, isConnected: true });
        mockSupabaseOr.mockResolvedValue({ data: [loan], error: null });

        render(<DashboardPage />);

        const repayButton = await screen.findByRole('button', { name: /repay loan/i });
        fireEvent.click(repayButton);

        expect(screen.getByRole('button', { name: /repaying.../i })).toBeDisabled();

        const expectedRepaymentAmount = ethers.parseEther((loan.amount + loan.interest).toString());
        await waitFor(() => expect(mockContractInstance.repay).toHaveBeenCalledWith({ value: expectedRepaymentAmount }));
        await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith({ status: 'paid' }));
        await waitFor(() => expect(global.alert).toHaveBeenCalledWith("Loan repaid successfully!"));
        await waitFor(() => expect(screen.getByText(/status: paid/i)).toBeInTheDocument());
    });


    it('shows error message if Supabase fetch fails', async () => {
        mockSupabaseOr.mockResolvedValue({ data: null, error: { message: 'Supabase network error' } });
        render(<DashboardPage />);
        await waitFor(() => {
            expect(screen.getByText(/supabasenetwork error/i)).toBeInTheDocument(); // Error messages are case-insensitive
        });
    });

    it('shows error message if a contract action fails', async () => {
        const loan = createMockLoan({ lender_address: lenderUser, borrower_address: borrowerUser, status: 'pending_borrower_acceptance' });
        mockUseAccount.mockReturnValue({ address: lenderUser, isConnected: true });
        mockSupabaseOr.mockResolvedValue({ data: [loan], error: null });
        mockContractInstance.cancel.mockRejectedValueOnce(new Error('Blockchain transaction failed'));

        render(<DashboardPage />);

        const cancelButton = await screen.findByRole('button', { name: /cancel loan/i });
        fireEvent.click(cancelButton);

        await waitFor(() => {
            expect(screen.getByText(/blockchain transaction failed/i)).toBeInTheDocument();
        });
        expect(mockSupabaseUpdate).not.toHaveBeenCalled(); // Ensure Supabase is not updated on contract failure
    });
  });
});
