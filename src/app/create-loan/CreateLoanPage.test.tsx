import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateLoanPage from './page'; // Adjust path as needed
import { useAuth } from '../../context/AuthContext';
import { useWallet } from '@meshsdk/react';
import { AppWallet, Transaction, Address } // Assuming Address might be needed for PKH derivation mock
  from '@meshsdk/core';
import { supabase } from '../../lib/supabaseClient'; // Mocked in jest.setup.js

// Mock specific Mesh SDK classes/functions if not fully covered by global mocks
jest.mock('@meshsdk/core', () => {
  const originalCore = jest.requireActual('@meshsdk/core');
  return {
    ...originalCore,
    AppWallet: jest.fn().mockImplementation(() => ({
      getPaymentAddress: jest.fn().mockReturnValue('addr_test_script123'),
      signTx: jest.fn().mockResolvedValue('signed_tx_cbor_hex'),
      submitTx: jest.fn().mockResolvedValue('tx_hash_123abc'),
      getUsedAddresses: jest.fn().mockResolvedValue(['addr_test_lender123']),
      // Add other methods if they are called and need specific mock behavior
    })),
    Transaction: jest.fn().mockImplementation(()_self => ({
      sendLovelace: jest.fn().mockReturnThis(),
      build: jest.fn().mockResolvedValue('unsigned_tx_cbor_hex'),
      // Add other methods if called
    })),
    Address: { // Mock static methods of Address if used directly
      ...originalCore.Address, // Keep original static methods not mocked
      from_bech32: jest.fn().mockImplementation((addr) => ({
        to_pub_key_hash: jest.fn().mockReturnValue({
          to_hex: jest.fn().mockReturnValue( addr === 'addr_test_lender123' ? 'lender_pkh_hex' : 'borrower_pkh_hex')
        }),
      })),
    }
  };
});


// Mock useAuth hook
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Mock useWallet hook (already partially mocked in WalletConnect.test.tsx, ensure consistency or refine)
jest.mock('@meshsdk/react', () => ({
  ...jest.requireActual('@meshsdk/react'),
  useWallet: jest.fn(),
}));

// Mock fetch for plutus.json
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      validators: [{ title: 'loan.spend', compiledCode: 'test_script_cbor_hex' }]
    }),
  })
) as jest.Mock;


describe('CreateLoanPage', () => {
  const mockUseAuth = useAuth as jest.Mock;
  const mockUseWallet = useWallet as jest.Mock;
  const mockSupabaseInsert = supabase.from('loans').insert as jest.Mock;

  beforeEach(() => {
    // Reset mocks for each test
    mockUseAuth.mockReset();
    mockUseWallet.mockReset();
    mockSupabaseInsert.mockClear();
    (fetch as jest.Mock).mockClear();
    // Clear mocks for AppWallet and Transaction instances if methods were called
     // This requires getting the mock constructor and clearing calls on its prototype or instances.
    (AppWallet as jest.Mock).mockClear();
    (Transaction as jest.Mock).mockClear();
     // Clear calls on mocked Address methods if necessary
    (Address.from_bech32 as jest.Mock).mockClear();


    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: { id: 'user-lender-id', email: 'lender@example.com' },
      loading: false,
    });
    mockUseWallet.mockReturnValue({
      wallet: {
        getUsedAddresses: jest.fn().mockResolvedValue(['addr_test_lender123']),
        // Mock other wallet methods if called by AppWallet constructor or other direct calls
      },
      connected: true,
      connect: jest.fn(),
      name: 'NamiTest',
    });
  });

  test('renders form fields', () => {
    render(<CreateLoanPage />);
    expect(screen.getByLabelText(/Borrower's User ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Borrower's Cardano Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount \(in USD\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Loan/i })).toBeInTheDocument();
  });

  test('updates form fields on user input', async () => {
    const user = userEvent.setup();
    render(<CreateLoanPage />);

    await user.type(screen.getByLabelText(/Borrower's User ID/i), 'borrower-uuid');
    expect(screen.getByLabelText(/Borrower's User ID/i)).toHaveValue('borrower-uuid');

    await user.type(screen.getByLabelText(/Borrower's Cardano Address/i), 'addr_test_borrower123');
    expect(screen.getByLabelText(/Borrower's Cardano Address/i)).toHaveValue('addr_test_borrower123');

    await user.type(screen.getByLabelText(/Amount \(in USD\)/i), '100');
    expect(screen.getByLabelText(/Amount \(in USD\)/i)).toHaveValue(100);

    await user.type(screen.getByLabelText(/Description/i), 'Test loan description');
    expect(screen.getByLabelText(/Description/i)).toHaveValue('Test loan description');
  });

  test('shows error if wallet not connected on submit', async () => {
    mockUseWallet.mockReturnValue({ ...mockUseWallet(), connected: false });
    const user = userEvent.setup();
    render(<CreateLoanPage />);

    await user.click(screen.getByRole('button', { name: /Create Loan/i }));

    expect(await screen.findByText('Please connect your Cardano wallet first.')).toBeInTheDocument();
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  test('successful form submission creates loan and deploys contract', async () => {
    const user = userEvent.setup();
    render(<CreateLoanPage />);

    // Fill form
    await user.type(screen.getByLabelText(/Borrower's User ID/i), 'borrower-uuid-test');
    await user.type(screen.getByLabelText(/Borrower's Cardano Address/i), 'addr_test_borrower456');
    await user.type(screen.getByLabelText(/Amount \(in USD\)/i), '250');
    await user.type(screen.getByLabelText(/Description/i), 'A successful test loan');

    // Mock AppWallet instance methods that would be called by Transaction
    // This is tricky because AppWallet is newed up inside handleSubmit
    // The jest.mock for @meshsdk/core already provides some default mocks.
    // We rely on those default mocks for getPaymentAddress, signTx, submitTx.

    mockSupabaseInsert.mockResolvedValueOnce({ error: null }); // Simulate successful Supabase insert

    await user.click(screen.getByRole('button', { name: /Create Loan/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/plutus.json');
    });

    // Verify AppWallet was instantiated (means wallet.getUsedAddresses was likely called)
    expect(AppWallet).toHaveBeenCalled();
    // Verify Transaction was instantiated
    expect(Transaction).toHaveBeenCalled();

    // Check if Supabase insert was called with expected data structure
    await waitFor(() => {
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            lender_id: 'user-lender-id',
            borrower_id: 'borrower-uuid-test',
            amount: 250,
            description: 'A successful test loan',
            status: 'pending_borrower_acceptance',
            contract_address: 'addr_test_script123', // from AppWallet mock
            contract_tx_hash: 'tx_hash_123abc',    // from AppWallet mock
            contract_datum: expect.objectContaining({
              lender_pubkeyhash: 'lender_pkh_hex', // from Address mock
              borrower_pubkeyhash: 'borrower_pkh_hex', // from Address mock
              loan_amount: 250_000_000, // 250 ADA in Lovelace
              interest_amount: 0,
              status: { "PendingAcceptance": [] },
              // deadline is dynamic, so harder to match exactly without more complex mocking
              deadline: expect.any(Number),
            }),
          }),
        ])
      );
    });
    // Check for navigation (router.push is mocked in jest.setup.js)
    // expect(require('next/navigation').useRouter().push).toHaveBeenCalledWith('/dashboard');
  });

  test('handles error during contract deployment (e.g., AppWallet error)', async () => {
    const user = userEvent.setup();
    render(<CreateLoanPage />);

    // Fill form
    await user.type(screen.getByLabelText(/Borrower's User ID/i), 'borrower-uuid-err');
    await user.type(screen.getByLabelText(/Borrower's Cardano Address/i), 'addr_test_borrower_err');
    await user.type(screen.getByLabelText(/Amount \(in USD\)/i), '50');
    await user.type(screen.getByLabelText(/Description/i), 'Error test');

    // Simulate an error during transaction building or submission
    // We need to make the AppWallet or Transaction mock throw an error
    // One way: re-mock Transaction to throw on .build() for this test
    (Transaction as jest.Mock).mockImplementationOnce(() => ({
        sendLovelace: jest.fn().mockReturnThis(),
        build: jest.fn().mockRejectedValue(new Error('Simulated TX Build Error')),
    }));

    await user.click(screen.getByRole('button', { name: /Create Loan/i }));

    expect(await screen.findByText(/Simulated TX Build Error/i)).toBeInTheDocument();
    expect(mockSupabaseInsert).not.toHaveBeenCalled();
  });

  test('handles error during Supabase insert after successful deployment', async () => {
    const user = userEvent.setup();
    render(<CreateLoanPage />);

    await user.type(screen.getByLabelText(/Borrower's User ID/i), 'borrower-supabase-err');
    await user.type(screen.getByLabelText(/Borrower's Cardano Address/i), 'addr_supabase_err');
    await user.type(screen.getByLabelText(/Amount \(in USD\)/i), '75');
    await user.type(screen.getByLabelText(/Description/i), 'Supabase error test');

    mockSupabaseInsert.mockResolvedValueOnce({ error: { message: 'Supabase insert failed', code: 'XYZ', details: '' } });

    await user.click(screen.getByRole('button', { name: /Create Loan/i }));

    expect(await screen.findByText(/Contract deployed \(TX: tx_hash_123abc\) but failed to save loan details to database: Supabase insert failed/i)).toBeInTheDocument();
  });

});
