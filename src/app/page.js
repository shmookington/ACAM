'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import TronGrid from '@/components/tron/TronGrid';
import TronCard from '@/components/tron/TronCard';
import TronButton from '@/components/tron/TronButton';
import styles from './page.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard');
      } else {
        setCheckingSession(false);
      }
    });
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isSignUp) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpErr) {
        setError(signUpErr.message);
        setLoading(false);
        return;
      }

      // Auto sign-in after sign-up
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        setError('Account created! Sign in with your credentials.');
        setIsSignUp(false);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    }

    router.push('/dashboard');
  };

  if (checkingSession) {
    return (
      <div className={styles.loadingScreen}>
        <TronGrid />
        <div className="tron-loader tron-loader-large" style={{ position: 'relative', zIndex: 1 }} />
      </div>
    );
  }

  return (
    <div className={styles.loginPage}>
      <TronGrid />

      <div className={styles.loginContainer}>
        {/* ACAM Logo / Title */}
        <div className={styles.logoSection}>
          <h1 className={`${styles.title} animate-boot-in`}>ACAM</h1>
          <p className={styles.subtitle}>
            Automated Customer Acquisition Machine
          </p>
          <div className={`${styles.divider} animate-boot-in delay-2`} />
        </div>

        {/* Login / Sign Up Form */}
        <TronCard className={`${styles.formCard} animate-boot-in delay-3`}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.systemStatus}>
              <span className={styles.statusDot} />
              <span>{isSignUp ? 'NEW OPERATOR REGISTRATION' : 'SYSTEM AUTHENTICATION REQUIRED'}</span>
            </div>

            <div className={styles.field}>
              <label htmlFor="email">Operator ID</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
                autoComplete="email"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">{isSignUp ? 'Create Access Code' : 'Access Code'}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={isSignUp ? 6 : undefined}
              />
            </div>

            {error && (
              <div className={styles.error}>
                ⚠ {error}
              </div>
            )}

            <TronButton
              type="submit"
              size="lg"
              loading={loading}
              className={styles.loginButton}
            >
              {isSignUp ? 'Create Account' : 'Initialize Session'}
            </TronButton>

            <button
              type="button"
              className={styles.toggleAuth}
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            >
              {isSignUp ? '← Back to Sign In' : 'New operator? Create account →'}
            </button>
          </form>
        </TronCard>

        <p className={`${styles.footer} animate-boot-in delay-5`}>
          ACAM v1.0 — Caelborne Digital
        </p>
      </div>
    </div>
  );
}

