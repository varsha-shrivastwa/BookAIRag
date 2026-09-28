'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm]         = useState({ identifier: '', password: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState('');
  const [btnHovered, setBtnHovered] = useState(false);

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.identifier.trim() || !form.password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: form.identifier.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'Login failed. Please check your credentials.');
        return;
      }
      login(data.token, data.user);
      router.push('/');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const S = {
    page: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 16px',
    },
    card: {
      width: '100%',
      maxWidth: '460px',
      borderRadius: '24px',
      overflow: 'hidden',
      background: 'linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
      border: '1px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(28px)',
      boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
    },
    accentBar: {
      height: '3px',
      background: 'linear-gradient(90deg, #7c3aed, #6366f1, #ec4899)',
    },
    body: {
      padding: '32px 32px 28px',
    },
    logoWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      marginBottom: '28px',
    },
    logoOuter: {
      position: 'relative',
      width: '64px',
      height: '64px',
      marginBottom: '12px',
    },
    logoGlow: {
      position: 'absolute',
      inset: 0,
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
      filter: 'blur(12px)',
      opacity: 0.65,
    },
    logoIcon: {
      position: 'relative',
      width: '64px',
      height: '64px',
      borderRadius: '16px',
      background: 'linear-gradient(135deg, #7c3aed, #6366f1, #ec4899)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
    },
    brandLabel: {
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: '#a78bfa',
      marginBottom: '4px',
    },
    title: {
      fontSize: '22px',
      fontWeight: 800,
      color: '#f1f5f9',
      letterSpacing: '-0.02em',
      textAlign: 'center',
      marginBottom: '4px',
    },
    subtitle: {
      fontSize: '13px',
      color: '#6b7280',
      textAlign: 'center',
      marginBottom: '24px',
    },
    divider: {
      height: '1px',
      background: 'rgba(255,255,255,0.07)',
      marginBottom: '24px',
    },
    fieldWrap: {
      marginBottom: '14px',
    },
    input: (name) => ({
      width: '100%',
      height: '52px',
      padding: '0 18px',
      borderRadius: '14px',
      border: `1.5px solid ${focused === name ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.12)'}`,
      background: focused === name ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
      boxShadow: focused === name ? '0 0 0 3px rgba(139,92,246,0.18)' : 'none',
      fontFamily: 'inherit',
    }),
    pwdWrap: {
      position: 'relative',
    },
    pwdInput: (name) => ({
      width: '100%',
      height: '52px',
      padding: '0 50px 0 18px',
      borderRadius: '14px',
      border: `1.5px solid ${focused === name ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.12)'}`,
      background: focused === name ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
      boxShadow: focused === name ? '0 0 0 3px rgba(139,92,246,0.18)' : 'none',
      fontFamily: 'inherit',
    }),
    eyeBtn: {
      position: 'absolute',
      right: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: '#6b7280',
      display: 'flex',
      alignItems: 'center',
      padding: '4px',
    },
    apiError: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      padding: '12px 16px',
      borderRadius: '12px',
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.22)',
      color: '#f87171',
      fontSize: '13px',
      marginBottom: '20px',
    },
    btn: (hovered) => ({
      width: '100%',
      height: '52px',
      marginTop: '8px',
      borderRadius: '14px',
      border: 'none',
      cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.65 : 1,
      background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
      color: '#fff',
      fontSize: '15px',
      fontWeight: 700,
      letterSpacing: '0.02em',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'all 0.25s',
      boxShadow: hovered ? '0 0 28px rgba(124,58,237,0.55)' : '0 4px 20px rgba(124,58,237,0.3)',
      transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
      fontFamily: 'inherit',
    }),
    footer: {
      padding: '18px 32px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
      textAlign: 'center',
      fontSize: '13px',
      color: '#6b7280',
    },
  };

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Accent bar */}
        <div style={S.accentBar} />

        <div style={S.body}>

          {/* Logo */}
          <div style={S.logoWrap}>
            <div style={S.logoOuter}>
              <div style={S.logoGlow} />
              <div style={S.logoIcon}>
                <BookOpen size={28} color="#fff" strokeWidth={2} />
              </div>
            </div>
            <span style={S.brandLabel}>BookAI</span>
            <h1 style={S.title}>Welcome back</h1>
            <p style={S.subtitle}>Sign in to continue to BookAI</p>
          </div>

          <div style={S.divider} />

          {/* Error */}
          {error && (
            <div style={S.apiError}>
              <span style={{ marginTop: '1px' }}>⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* Email / Username */}
            <div style={S.fieldWrap}>
              <input
                type="text" name="identifier" value={form.identifier}
                onChange={handleChange}
                onFocus={() => setFocused('identifier')}
                onBlur={() => setFocused('')}
                placeholder="Enter your email or username"
                autoComplete="username"
                style={S.input('identifier')}
              />
            </div>

            {/* Password */}
            <div style={S.fieldWrap}>
              <div style={S.pwdWrap}>
                <input
                  type={showPwd ? 'text' : 'password'} name="password" value={form.password}
                  onChange={handleChange}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={S.pwdInput('password')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} style={S.eyeBtn}>
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              style={S.btn(btnHovered)}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Log in'}
            </button>

          </form>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
            Create one
          </Link>
        </div>

      </div>
    </div>
  );
}
