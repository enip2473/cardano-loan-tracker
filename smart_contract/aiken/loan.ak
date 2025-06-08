// SPDX-License-Identifier: Apache-2.0
// Aiken Smart Contract for a Loan Agreement

// --- Type Definitions ---

/// Possible statuses for the loan
type LoanStatus =
  PendingAcceptance | Active | Paid | Defaulted

/// Datum for the loan contract
type LoanDatum = {
  lender_pubkeyhash: ByteArray,
  borrower_pubkeyhash: ByteArray,
  loan_amount: Int,
  interest_amount: Int,
  deadline: Int, // POSIX time
  status: LoanStatus,
}

/// Redeemer actions for the loan contract
type LoanRedeemer =
  AcceptLoan
  | RepayLoan
  | ClaimPayment
  | ClaimDefault

// --- Validators ---

// Placeholder for the main spend validator
validator spend(datum: LoanDatum, redeemer: LoanRedeemer, context: ScriptContext) -> Bool {
  when redeemer is {
    AcceptLoan -> {
      // Validator checks for AcceptLoan:
      // 1. Signer must be the borrower.
      // 2. Datum status must be PendingAcceptance.
      let signed_by_borrower =
        context.transaction.extra_signatories
          |> list.has(datum.borrower_pubkeyhash)

      let is_pending_acceptance = datum.status == PendingAcceptance

      // Action:
      // If checks pass, the transaction should output a new datum with status Active.
      // This is implicitly handled by the off-chain code constructing the transaction.
      // The validator's role is to ensure the conditions for this transition are met.
      signed_by_borrower && is_pending_acceptance
    }
    RepayLoan -> {
      // Validator checks for RepayLoan:
      // 1. Signer must be the borrower.
      // 2. Datum status must be Active.
      // 3. Output to lender's address matches loan_amount + interest_amount.
      // 4. Transaction is within the deadline.

      let signed_by_borrower =
        context.transaction.extra_signatories
          |> list.has(datum.borrower_pubkeyhash)

      let is_active = datum.status == Active

      // Check for payment to the lender
      let expected_payment = datum.loan_amount + datum.interest_amount
      let payment_to_lender =
        context.transaction.outputs
          |> list.any(fn(output) {
            output.address.payment_credential == PubKeyCredential(datum.lender_pubkeyhash) &&
            output.value.lovelace == expected_payment
          })

      // Check deadline: current time (upper bound of validity interval) <= deadline
      // The transaction's validity interval indicates when it can be processed.
      // We need to ensure the upper bound of this interval is not after the deadline.
      let within_deadline =
        when context.transaction.validity_interval.upper_bound is {
          Finite(tx_upper_bound) -> tx_upper_bound <= datum.deadline
          Infinite -> False // Repayment must happen by a specific time
        }

      // Action:
      // If checks pass, the transaction should output a new datum with status Paid
      // or simply allow funds to be moved (validator allows spend).
      // The new datum state is handled by off-chain code.
      signed_by_borrower && is_active && payment_to_lender && within_deadline
    }
    ClaimPayment -> {
      // Validator checks for ClaimPayment:
      // 1. Signer must be the lender.
      // 2. Datum status must be Paid.
      // This action allows the lender to collect the funds from the script address
      // after they have been marked as 'Paid'.

      let signed_by_lender =
        context.transaction.extra_signatories
          |> list.has(datum.lender_pubkeyhash)

      let is_paid = datum.status == Paid

      // Action:
      // Allows the lender to take the funds from the script address.
      // The transaction built by the lender will move the UTXO's value.
      signed_by_lender && is_paid
    }
    ClaimDefault -> {
      // Validator checks for ClaimDefault:
      // 1. Signer must be the lender.
      // 2. Datum status must be Active (loan accepted, not yet Paid or Defaulted).
      // 3. Current time (lower bound of validity interval) must be past the deadline.

      let signed_by_lender =
        context.transaction.extra_signatories
          |> list.has(datum.lender_pubkeyhash)

      let is_active = datum.status == Active

      // Check deadline: current time (lower bound of validity interval) > deadline
      // The transaction's validity interval indicates when it can be processed.
      // For claiming default, the transaction must not be valid *before* the deadline has passed.
      let past_deadline =
        when context.transaction.validity_interval.lower_bound is {
          Finite(tx_lower_bound) -> tx_lower_bound > datum.deadline
          // If lower bound is infinite, it means it's valid from the beginning of time,
          // which wouldn't make sense for a default claim that depends on a deadline.
          // However, transaction validity typically starts at a specific slot/time.
          Infinite -> False
        }

      // Action:
      // Allows the lender to take the funds from the script address if the loan defaulted.
      // The transaction should update datum status to Defaulted or consume the input.
      signed_by_lender && is_active && past_deadline
    }
  }
}

// --- Helper Functions for Testing ---

// Creates a basic ScriptPurpose. For spend validators, this is Spending(some_output_reference).
// As we are unit testing the validator logic directly, the specific OutputReference isn't crucial.
fn mock_script_purpose() -> ScriptPurpose {
  Spending(OutputReference { transaction_id: #"mock_tx_id", output_index: 0 })
}

// Creates a mock Transaction for ScriptContext.
// We'll customize inputs, outputs, and signatories as needed per test.
fn mock_transaction(extra_signatories: List<ByteArray>, outputs: List<TransactionOutput>) -> Transaction {
  Transaction {
    inputs: list.new(), // Not directly used by these validators' logic but required by type
    outputs: outputs,
    fee: 0, // Not relevant for validator logic
    mint: list.new(), // Not relevant
    withdrawals: list.new(), // Not relevant
    certificates: list.new(), // Not relevant
    extra_signatories: extra_signatories,
    validity_interval: ValidityInterval { lower_bound: Finite(0), upper_bound: Infinite }, // Customize as needed
    reference_inputs: list.new(), // Not relevant
  }
}

// --- Tests ---

// Define some mock public key hashes for testing
let lender_pkh: ByteArray = #"lender_pkh_mock"
let borrower_pkh: ByteArray = #"borrower_pkh_mock"
let other_pkh: ByteArray = #"other_pkh_mock"

test accept_loan_success() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000, // Some future time
      status: PendingAcceptance,
    }
  let redeemer = AcceptLoan

  // Borrower is signing
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == True
}

test accept_loan_fail_wrong_signer() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: PendingAcceptance,
    }
  let redeemer = AcceptLoan

  // Lender is signing (should be borrower)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == False
}

// --- Tests for ClaimDefault ---

test claim_default_success() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000, // Deadline is 1000
      status: Active,
    }
  let redeemer = ClaimDefault

  // Lender is signing, transaction lower bound is 1100 (after deadline)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new())
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(1100), upper_bound: Infinite } }
        },
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == True
}

test claim_default_fail_wrong_signer() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Active,
    }
  let redeemer = ClaimDefault

  // Borrower is signing (should be lender)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), list.new())
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(1100), upper_bound: Infinite } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test claim_default_fail_wrong_status() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Paid, // Status is Paid, should be Active for default claim
    }
  let redeemer = ClaimDefault

  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new())
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(1100), upper_bound: Infinite } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test claim_default_fail_before_deadline() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000, // Deadline is 1000
      status: Active,
    }
  let redeemer = ClaimDefault

  // Transaction lower bound is 900 (before deadline)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new())
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(900), upper_bound: Infinite } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

// --- Tests for ClaimPayment ---

test claim_payment_success() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Paid, // Loan is Paid
    }
  let redeemer = ClaimPayment

  // Lender is signing
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == True
}

test claim_payment_fail_wrong_signer() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Paid,
    }
  let redeemer = ClaimPayment

  // Borrower is signing (should be lender)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == False
}

test claim_payment_fail_wrong_status() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Active, // Loan is Active, not Paid
    }
  let redeemer = ClaimPayment

  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == False
}

// --- Tests for RepayLoan ---

test repay_loan_success() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000, // Deadline is 1000
      status: Active,
    }
  let redeemer = RepayLoan

  let expected_payment = datum.loan_amount + datum.interest_amount
  let lender_address = Address { payment_credential: PubKeyCredential(lender_pkh), staking_credential: None }

  let tx_outputs = list.new() |> list.prepend(TransactionOutput { address: lender_address, value: Value { lovelace: expected_payment, tokens: dict.new() } })

  // Borrower is signing, payment is correct, deadline is 1000, tx upper bound is 900 (before deadline)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), tx_outputs)
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(800), upper_bound: Finite(900) } }
        },
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == True
}

test repay_loan_fail_wrong_signer() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Active,
    }
  let redeemer = RepayLoan
  let expected_payment = datum.loan_amount + datum.interest_amount
  let lender_address = Address { payment_credential: PubKeyCredential(lender_pkh), staking_credential: None }
  let tx_outputs = list.new() |> list.prepend(TransactionOutput { address: lender_address, value: Value { lovelace: expected_payment, tokens: dict.new() } })


  // Lender is signing (should be borrower)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(lender_pkh), tx_outputs)
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(800), upper_bound: Finite(900) } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test repay_loan_fail_wrong_status() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Paid, // Status is Paid, should be Active
    }
  let redeemer = RepayLoan
  // ... (rest of setup similar to success case)
  let expected_payment = datum.loan_amount + datum.interest_amount
  let lender_address = Address { payment_credential: PubKeyCredential(lender_pkh), staking_credential: None }
  let tx_outputs = list.new() |> list.prepend(TransactionOutput { address: lender_address, value: Value { lovelace: expected_payment, tokens: dict.new() } })

  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), tx_outputs)
       |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(800), upper_bound: Finite(900) } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test repay_loan_fail_incorrect_amount() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Active,
    }
  let redeemer = RepayLoan
  // Incorrect payment (missing interest)
  let incorrect_payment = datum.loan_amount
  let lender_address = Address { payment_credential: PubKeyCredential(lender_pkh), staking_credential: None }
  let tx_outputs = list.new() |> list.prepend(TransactionOutput { address: lender_address, value: Value { lovelace: incorrect_payment, tokens: dict.new() } })

  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), tx_outputs)
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(800), upper_bound: Finite(900) } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test repay_loan_fail_after_deadline() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000, // Deadline is 1000
      status: Active,
    }
  let redeemer = RepayLoan
  let expected_payment = datum.loan_amount + datum.interest_amount
  let lender_address = Address { payment_credential: PubKeyCredential(lender_pkh), staking_credential: None }
  let tx_outputs = list.new() |> list.prepend(TransactionOutput { address: lender_address, value: Value { lovelace: expected_payment, tokens: dict.new() } })

  // Transaction upper bound is 1100 (after deadline)
  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), tx_outputs)
        |> fn(tx) {
          Transaction { ..tx, validity_interval: ValidityInterval { lower_bound: Finite(800), upper_bound: Finite(1100) } }
        },
      purpose: mock_script_purpose(),
    }
  spend(datum, redeemer, context) == False
}

test accept_loan_fail_wrong_status() {
  let datum =
    LoanDatum {
      lender_pubkeyhash: lender_pkh,
      borrower_pubkeyhash: borrower_pkh,
      loan_amount: 100_000_000,
      interest_amount: 10_000_000,
      deadline: 1000,
      status: Active, // Status is already Active, should fail
    }
  let redeemer = AcceptLoan

  let context =
    ScriptContext {
      transaction: mock_transaction(list.new() |> list.prepend(borrower_pkh), list.new()),
      purpose: mock_script_purpose(),
    }

  spend(datum, redeemer, context) == False
}
