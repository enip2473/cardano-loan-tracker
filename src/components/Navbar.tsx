// components/Navbar.tsx
"use client";

import Link from 'next/link';
import CustomConnectWallet from './CustomConnectWallet';

const navStyles = {
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6',
  },
  brand: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textDecoration: 'none',
    color: '#333',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
  },
  navLink: {
    marginLeft: '1rem',
    textDecoration: 'none',
    color: '#007bff',
  },
  userInfo: {
    marginLeft: '1rem',
    color: '#555',
  },
  logoutButton: {
    marginLeft: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
};

export default function Navbar() {
  return (
    <nav style={navStyles.navbar}>
      <Link href="/" style={navStyles.brand}>
        LoanTracker
      </Link>
      <div style={navStyles.links}>
        <Link href="/dashboard" style={navStyles.navLink}>
          Dashboard
        </Link>
        <Link href="/create-loan" style={navStyles.navLink}>
          Create Loan
        </Link>
        <div className='ml-2'>
          <CustomConnectWallet />
        </div>
      </div>
    </nav>
  );
}