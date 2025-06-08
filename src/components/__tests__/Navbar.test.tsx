// src/components/__tests__/Navbar.test.tsx
import { render, screen } from '@testing-library/react';
import Navbar from '../Navbar';
import '@testing-library/jest-dom';

// Mock Next.js Link component
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children, href }: any) => {
    return <a href={href}>{children}</a>;
  };
});

// Mock CustomConnectWallet component
jest.mock('../CustomConnectWallet', () => {
  return function DummyCustomConnectWallet() {
    return <div data-testid="custom-connect-wallet">Connect Wallet Mock</div>;
  };
});

describe('Navbar', () => {
  beforeEach(() => {
    render(<Navbar />);
  });

  it('renders the brand name "LoanTracker"', () => {
    const brandElement = screen.getByText('LoanTracker');
    expect(brandElement).toBeInTheDocument();
    expect(brandElement).toHaveAttribute('href', '/');
  });

  it('renders the "Dashboard" link with correct href', () => {
    const dashboardLink = screen.getByText('Dashboard');
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders the "Create Loan" link with correct href', () => {
    const createLoanLink = screen.getByText('Create Loan');
    expect(createLoanLink).toBeInTheDocument();
    expect(createLoanLink).toHaveAttribute('href', '/create-loan');
  });

  it('renders the CustomConnectWallet component', () => {
    expect(screen.getByTestId('custom-connect-wallet')).toBeInTheDocument();
    expect(screen.getByText('Connect Wallet Mock')).toBeInTheDocument();
  });
});
