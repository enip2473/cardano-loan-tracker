// app/login/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path if needed
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // For linking to the signup page
import { AuthError } from '@supabase/supabase-js';

// Re-using styles from SignUp page for consistency, or define separately
const styles = {
  container: { /* ... same as above ... */ },
  formGroup: { /* ... same as above ... */ },
  label: { /* ... same as above ... */ },
  input: { /* ... same as above ... */ },
  button: { /* ... same as above ... */ },
  error: { /* ... same as above ... */ },
  link: { /* ... same as above ... */ },
};
// For brevity, copy the style object from the SignUp page here or import from a shared file.
// For this example, assume styles are copied from above.
// A better approach for larger apps is a global CSS file or CSS Modules.
Object.assign(styles, {
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
    boxSizing: 'border-box' as 'border-box',
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
  link: {
    display: 'block',
    marginTop: '15px',
    textAlign: 'center' as 'center',
    color: '#0070f3',
    textDecoration: 'none',
  },
});


export default function LogInPage() {
  const { signIn, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<AuthError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError, data } = await signIn({ email, password });
      if (signInError) throw signInError;
      if (data.user) {
        router.push('/dashboard');
      } else if (!data.session && !data.user) {
        setError({ name: "CredentialsInvalid", message: "Invalid login credentials." } as AuthError);
      }
    } catch (err) {
      if (err instanceof AuthError) {
        setError(err);
      } else if (err instanceof Error) {
        setError({ name: "SignInError", message: err.message } as AuthError);
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
      <h2>Log In</h2>
      <form onSubmit={handleSubmit}>
        {error && <p style={styles.error}>Error: {error.message}</p>}
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
          {loading ? 'Logging In...' : 'Log In'}
        </button>
      </form>
      <Link href="/signup" style={styles.link}>
        Don't have an account? Sign Up
      </Link>
    </div>
  );
}