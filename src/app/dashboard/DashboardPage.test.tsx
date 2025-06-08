import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './page'; // Adjust path as needed
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '@meshsdk/react';
import { supabase } from '../../lib/supabaseClient'; // Mocked in jest.setup.js
import { AppWallet, Transaction, Address } from '@meshsdk/core'; // For mocking

// Mock Mesh SDK core components used in handlers
jest.mock('@meshsdk/core', () => {
  const originalCore = jest.requireActual('@meshsdk/core');
  return {
    ...originalCore,
    AppWallet: jest.fn().mockImplementation(() => ({
      getUtxos: jest.fn().mockResolvedValue([
        // Mock a UTXO that can be found by the handlers
        {
          input: { txHash: 'dummy_tx_hash', outputIndex: 0 },
          output: {
            address: 'addr_test_script123',
            amount: [{ unit: 'lovelace', quantity: '100000000' }] // Matches default mock loan amount
          },
        }
      ]),
      signTx: jest.fn().mockResolvedValue('signed_tx_cbor_hex_dashboard'),
      submitTx: jest.fn().mockResolvedValue('tx_hash_dashboard_action'),
      // getUsedAddresses: jest.fn().mockResolvedValue(['addr_test_borrower_wallet_addr']), // if needed for signer checks
      getChangeAddress: jest.fn().mockResolvedValue('addr_test_borrower_wallet_addr'), // If required by .setRequiredSigners or similar
    })),
    Transaction: jest.fn().mockImplementation(() => ({
      redeemValue: jest.fn().mockReturnThis(),
      sendValue: jest.fn().mockReturnThis(),
      sendLovelace: jest.fn().mockReturnThis(), // For RepayLoan
      build: jest.fn().mockResolvedValue('unsigned_tx_cbor_hex_dashboard'),
      setRequiredSigners: jest.fn().mockReturnThis(), // If used
    })),
    Address: {
        ...originalCore.Address,
        from_bech32: jest.fn().mockImplementation(addr => ({
            to_pub_key_hash: jest.fn().mockReturnValue({ to_hex: jest.fn().mockReturnValue(`${addr}_pkh_hex`) }),
        })),
        from_payment_credential: jest.fn().mockReturnValue('addr_test_lender_from_pkh'),
    },
  };
});

// Mock useAuth and useWallet
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@meshsdk/react', () => ({ ...jest.requireActual('@meshsdk/react'), useWallet: jest.fn() }));

// Mock fetch for plutus.json
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      validators: [{ title: 'loan.spend', compiledCode: 'test_script_cbor_hex_dashboard' }]
    }),
  })
) as jest.Mock;


// Mock Supabase data
const mockSupabaseSelect = supabase.from('loans').select as jest.Mock;
const mockSupabaseUpdate = supabase.from('loans').update as jest.Mock;


const mockUser = { id: 'user-borrower-id', email: 'borrower@example.com' };
const mockLenderUser = { id: 'user-lender-id', email: 'lender@example.com' };

const mockLoans = [
  {
    id: '1', lender_id: mockLenderUser.id, borrower_id: mockUser.id, amount: 100, status: 'pending_borrower_acceptance', description: 'Loan 1',
    contract_address: 'addr_test_script123',
    contract_datum: { lender_pubkeyhash: 'lender_pkh1', borrower_pubkeyhash: 'borrower_pkh1', loan_amount: 100000000, interest_amount: 0, deadline: Date.now()/1000 + 3600, status: { "PendingAcceptance": [] } },
    contract_tx_hash: 'txhash1', collateral_amount: 0
  },
  {
    id: '2', lender_id: mockLenderUser.id, borrower_id: mockUser.id, amount: 200, status: 'active', description: 'Loan 2 Active',
    contract_address: 'addr_test_script456',
    contract_datum: { lender_pubkeyhash: 'lender_pkh2', borrower_pubkeyhash: 'borrower_pkh2', loan_amount: 200000000, interest_amount: 1000000, deadline: Date.now()/1000 + 7200, status: { "Active": [] } },
    contract_tx_hash: 'txhash2', collateral_amount: 0
  },
  {
    id: '3', lender_id: mockUser.id, borrower_id: 'user-other-borrower', amount: 150, status: 'active', description: 'Loan 3 Lent',
    contract_address: 'addr_test_script789',
    contract_datum: { lender_pubkeyhash: `${mockUser.id}_pkh`, borrower_pubkeyhash: 'other_borrower_pkh', loan_amount: 150000000, interest_amount: 0, deadline: Date.now()/1000 + 3600, status: { "Active": [] } },
    contract_tx_hash: 'txhash3', collateral_amount: 0
  }
];

describe('DashboardPage', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseWallet = useWallet as jest.Mock;

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
    mockUseWallet.mockReturnValue({ wallet: { name: 'NamiTest'}, connected: true, connect: jest.fn() });
    mockSupabaseSelect.mockResolvedValue({ data: mockLoans, error: null });
    mockSupabaseUpdate.mockResolvedValue({ error: null });
    (fetch as jest.Mock).mockClear();
    (AppWallet as jest.Mock).mockClear();
    (Transaction as jest.Mock).mockClear();
  });

  test('renders loans correctly, including contract details', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Loan 1')).toBeInTheDocument());

    // Check for contract details display (for loan 1)
    expect(screen.getByText((content, el) => el?.textContent === 'Contract Address: addr_test_script123....')).toBeInTheDocument();
    expect(screen.getByText((content, el) => el?.textContent === 'Deployment TX: txhash1....')).toBeInTheDocument();
    expect(screen.getByText('On-Chain Status: PendingAcceptance')).toBeInTheDocument();
  });

  test('Accept Loan button calls handleAcceptLoanOnChain', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Loan 1')).toBeInTheDocument());
    const acceptButton = screen.getByRole('button', { name: /Accept Loan \(On-Chain\)/i });

    // Spy on the actual implementation if possible, or ensure mocks are hit
    // For this test, we'll check if AppWallet and Transaction were called as a proxy

    await user.click(acceptButton);

    await waitFor(() => {
      expect(AppWallet).toHaveBeenCalled(); // Called within handleAcceptLoanOnChain
      expect(Transaction).toHaveBeenCalled(); // Called within handleAcceptLoanOnChain
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'active', contract_datum: expect.any(Object) }));
    });
  });

  test('Mark as Paid button calls handleMarkAsPaidOnChain', async () => {
    const user = userEvent.setup();
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Loan 2 Active')).toBeInTheDocument());
    const markAsPaidButton = screen.getByRole('button', { name: /Repay Loan \(On-Chain\)/i });

    await user.click(markAsPaidButton);

    await waitFor(() => {
      expect(AppWallet).toHaveBeenCalled(); // Called within handleMarkAsPaidOnChain
      expect(Transaction).toHaveBeenCalled(); // Called within handleMarkAsPaidOnChain
      // Check that it tried to pay the lender
      const transactionInstance = (Transaction as jest.Mock).mock.results[0].value; // Get the instance
      expect(transactionInstance.sendLovelace).toHaveBeenCalledWith(
        'addr_test_lender_from_pkh', // Mocked lender address from PKH
        (mockLoans[1].contract_datum.loan_amount + mockLoans[1].contract_datum.interest_amount).toString()
      );
      expect(mockSupabaseUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', contract_datum: expect.any(Object) }));
    });
  });

  test('displays error message if on-chain action fails', async () => {
    const user = userEvent.setup();
    // Simulate an error from AppWallet.submitTx()
    (AppWallet as jest.Mock).mockImplementationOnce(() => ({
        getUtxos: jest.fn().mockResolvedValue([{ input: {}, output: { amount: [{unit: 'lovelace', quantity: '100000000'}]}}]), // mock a found UTXO
        signTx: jest.fn().mockResolvedValue('signed_tx_fail'),
        submitTx: jest.fn().mockRejectedValue(new Error('On-chain submission failed')),
        getChangeAddress: jest.fn().mockResolvedValue('addr_test_borrower_wallet_addr'),
    }));

    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('Loan 1')).toBeInTheDocument());
    const acceptButton = screen.getByRole('button', { name: /Accept Loan \(On-Chain\)/i });
    await user.click(acceptButton);

    expect(await screen.findByText(/On-chain submission failed/i)).toBeInTheDocument();
  });

});
