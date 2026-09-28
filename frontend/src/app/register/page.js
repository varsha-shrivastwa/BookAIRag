'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const PWD_RULES = [
  { label: 'At least 5 chars',          test: v => v.length >= 5 },
  { label: 'Contains a letter',          test: v => /[a-zA-Z]/.test(v) },
  { label: 'Contains a number',          test: v => /[0-9]/.test(v) },
  { label: 'Contains a special symbol',  test: v => /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/.test(v) },
];

const STRENGTH_COLOR = ['#ef4444', '#f97316', '#eab308', '#10b981'];
const STRENGTH_LABEL = ['Weak', 'Fair', 'Good', 'Strong'];

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [form, setForm]         = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    setErrors(err => ({ ...err, [name]: '' }));
    setApiError('');
  }

  function validate() {
    const errs = {};
    if (!form.firstName.trim()) errs.firstName = 'First name is required.';
    if (!form.lastName.trim())  errs.lastName  = 'Last name is required.';
    if (!form.email.trim())                                   errs.email    = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email    = 'Enter a valid email.';
    if (!PWD_RULES.every(r => r.test(form.password)))         errs.password = 'Password does not meet all requirements.';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    setApiError('');
    try {
      const username = form.email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9_]/g, '') || 'user';
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: `${form.firstName.trim()} ${form.lastName.trim()}`,
          email:    form.email.trim().toLowerCase(),
          username,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join(' ') : data?.message;
        setApiError(msg || 'Registration failed. Please try again.');
        return;
      }
      login(data.token, data.user);
      router.push('/');
    } catch {
      setApiError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const pwdStrength = PWD_RULES.filter(r => r.test(form.password)).length;

  /* Inline styles — guaranteed to apply regardless of Tailwind purging */
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
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px',
      marginBottom: '14px',
    },
    fieldWrap: {
      marginBottom: '14px',
    },
    input: (name) => ({
      width: '100%',
      height: '52px',
      padding: '0 18px',
      borderRadius: '14px',
      border: `1.5px solid ${errors[name] ? 'rgba(239,68,68,0.6)' : focused === name ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.12)'}`,
      background: focused === name ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
      boxShadow: errors[name]
        ? '0 0 0 3px rgba(239,68,68,0.12)'
        : focused === name
          ? '0 0 0 3px rgba(139,92,246,0.18)'
          : 'none',
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
      border: `1.5px solid ${errors[name] ? 'rgba(239,68,68,0.6)' : focused === name ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.12)'}`,
      background: focused === name ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
      boxShadow: errors[name]
        ? '0 0 0 3px rgba(239,68,68,0.12)'
        : focused === name
          ? '0 0 0 3px rgba(139,92,246,0.18)'
          : 'none',
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
    errorTxt: {
      fontSize: '11px',
      color: '#f87171',
      marginTop: '5px',
      paddingLeft: '4px',
    },
    strengthBar: {
      marginTop: '10px',
      display: 'flex',
      gap: '6px',
    },
    strengthSegment: (i) => ({
      height: '4px',
      flex: 1,
      borderRadius: '4px',
      background: i < pwdStrength ? STRENGTH_COLOR[pwdStrength - 1] : 'rgba(255,255,255,0.10)',
      transition: 'background 0.3s',
    }),
    strengthLabel: {
      fontSize: '11px',
      fontWeight: 600,
      color: pwdStrength > 0 ? STRENGTH_COLOR[pwdStrength - 1] : 'transparent',
      marginTop: '4px',
      paddingLeft: '2px',
      transition: 'color 0.3s',
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

  const [btnHovered, setBtnHovered] = useState(false);

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
            <h1 style={S.title}>Create your account</h1>
            <p style={S.subtitle}>Join BookAI and discover your next great read</p>
          </div>

          <div style={S.divider} />

          {/* API error */}
          {apiError && (
            <div style={S.apiError}>
              <span style={{ marginTop: '1px' }}>⚠</span>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>

            {/* First + Last Name */}
            <div style={S.row}>
              <div>
                <input
                  type="text" name="firstName" value={form.firstName}
                  onChange={handleChange}
                  onFocus={() => setFocused('firstName')}
                  onBlur={() => setFocused('')}
                  placeholder="First name"
                  autoComplete="given-name"
                  style={S.input('firstName')}
                />
                {errors.firstName && <p style={S.errorTxt}>{errors.firstName}</p>}
              </div>
              <div>
                <input
                  type="text" name="lastName" value={form.lastName}
                  onChange={handleChange}
                  onFocus={() => setFocused('lastName')}
                  onBlur={() => setFocused('')}
                  placeholder="Last name"
                  autoComplete="family-name"
                  style={S.input('lastName')}
                />
                {errors.lastName && <p style={S.errorTxt}>{errors.lastName}</p>}
              </div>
            </div>

            {/* Email */}
            <div style={S.fieldWrap}>
              <input
                type="email" name="email" value={form.email}
                onChange={handleChange}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused('')}
                placeholder="Enter your email address"
                autoComplete="email"
                style={S.input('email')}
              />
              {errors.email && <p style={S.errorTxt}>{errors.email}</p>}
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
                  autoComplete="new-password"
                  style={S.pwdInput('password')}
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPwd(v => !v)} style={S.eyeBtn}>
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Strength bar */}
              {form.password && (
                <>
                  <div style={S.strengthBar}>
                    {[0, 1, 2, 3].map(i => <div key={i} style={S.strengthSegment(i)} />)}
                  </div>
                  <p style={S.strengthLabel}>{pwdStrength > 0 ? STRENGTH_LABEL[pwdStrength - 1] : ''}</p>
                </>
              )}
              {errors.password && !form.password && <p style={S.errorTxt}>{errors.password}</p>}
            </div>

            {/* Register button */}
            <button
              type="submit"
              disabled={loading}
              style={S.btn(btnHovered)}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
            >
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating account…</> : 'Register'}
            </button>

          </form>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
            Log in
          </Link>
        </div>

      </div>
    </div>
  );
}
