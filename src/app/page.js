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

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
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

        {/* Login Form */}
        <TronCard className={`${styles.formCard} animate-boot-in delay-3`}>
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.systemStatus}>
              <span className={styles.statusDot} />
              <span>SYSTEM AUTHENTICATION REQUIRED</span>
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
              <label htmlFor="password">Access Code</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                autoComplete="current-password"
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
              Initialize Session
            </TronButton>
          </form>
        </TronCard>

        <p className={`${styles.footer} animate-boot-in delay-5`}>
          ACAM v1.0 — Caelborne Digital
        </p>
      </div>
    </div>
  );
}
