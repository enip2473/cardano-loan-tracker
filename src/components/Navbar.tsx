// components/Navbar.tsx
"use client";

import Link from 'next/link';
import { useAuth } from '../context/AuthContext'; // Adjust path: if components is in root, use './context/AuthContext'
import { useRouter } from 'next/navigation';

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
  const { user, signOut, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error logging out:', error.message);
      // Optionally show an error message to the user
    }
    router.push('/login'); // Or to your homepage
  };

  // A simple loading state for the navbar if auth state is still being determined
  if (loading) {
    return (
      <nav style={navStyles.navbar}>
        <Link href="/" style={navStyles.brand}>LoanTracker</Link>
        <div style={navStyles.links}>
          Loading...
        </div>
      </nav>
    );
  }

  return (
    <nav style={navStyles.navbar}>
      <Link href="/" style={navStyles.brand}>
        LoanTracker
      </Link>
      <div style={navStyles.links}>
        <Link href="/dashboard" style={navStyles.navLink}>
            Dashboard
        </Link>
        {user ? (
          <>
            <Link href="/create-loan" style={navStyles.navLink}>
              Create Loan
            </Link>
            <span style={navStyles.userInfo}>Hi, {user.email}</span>
            <button onClick={handleLogout} style={navStyles.logoutButton}>
              Logout
            </button>
          </>
        ) : (
          <>
            <Link href="/login" style={navStyles.navLink}>
              Login
            </Link>
            <Link href="/signup" style={navStyles.navLink}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}