// app/signup/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // For linking to the login page
import { AuthError } from '@supabase/supabase-js';

// Basic styling (you can move this to a CSS file)
const styles = {
  container: {
    maxWidth: '400px',
    margin: '50px auto',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  formGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as 'border-box', // TypeScript fix for boxSizing
  },
  button: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  error: {
    color: 'red',
    marginBottom: '10px',
  },
  message: {
    color: 'green',
    marginBottom: '10px',
  },
  link: {
    display: 'block',
    marginTop: '15px',
    textAlign: 'center' as 'center',
    color: '#0070f3',
    textDecoration: 'none',
  },
};

export default function SignUpPage() {
  const { signUp, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<AuthError | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard'); // Or your desired redirect path
    }
  }, [user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);
    try {
      const { error: signUpError, data } = await signUp({ email, password });
      if (signUpError) throw signUpError;

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage('Sign up successful! Please check your email to confirm your account.');
      } else if (data.user) {
        setMessage('Sign up successful! You can now log in.');
      } else {
        setMessage('Sign up request sent! Please check your email to confirm your account.');
      }
      setEmail('');
      setPassword('');
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err);
      } else if (err instanceof Error) {
        setError({ name: "SignUpError", message: err.message } as AuthError);
      } else {
        setError({ name: "UnknownError", message: "An unknown error occurred" } as AuthError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (user && !error) return <p>Redirecting...</p>;

  return (
    <div style={styles.container}>
      <h2>Sign Up</h2>
      <form onSubmit={handleSubmit}>
        {error && <p style={styles.error}>Error: {error.message}</p>}
        {message && <p style={styles.message}>{message}</p>}
        <div style={styles.formGroup}>
          <label htmlFor="email" style={styles.label}>Email</label>
          <input
            type="email"
            id="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
          />
        </div>
        <div style={styles.formGroup}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            type="password"
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={styles.input}
            disabled={loading}
          />
        </div>
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
      </form>
      <Link href="/login" style={styles.link}>
        Already have an account? Log In
      </Link>
    </div>
  );
}