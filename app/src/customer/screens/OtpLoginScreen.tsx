import { useState, useEffect, useRef } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { auth, firebaseAuthEnabled } from '../firebase';
import { customerApi } from '../api/customerApi';
import { useCustomer } from '../CustomerContext';

declare global {
  interface Window { recaptchaVerifier?: RecaptchaVerifier; }
}

type AuthMethod = 'phone' | 'email';
type PhoneStep = 'input' | 'otp';
type EmailStep = 'input' | 'otp';

export default function OtpLoginScreen() {
  const { setAuth, tableNumber } = useCustomer();

  const [method, setMethod] = useState<AuthMethod>('phone');

  // Phone state
  const [phone, setPhone] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');
  const [otpCode, setOtpCode] = useState('');
  const confirmRef = useRef<ConfirmationResult | null>(null);

  // Email state
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailStep, setEmailStep] = useState<EmailStep>('input');

  // Shared
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Set up invisible reCAPTCHA once (for phone)
  useEffect(() => {
    if (!firebaseAuthEnabled || !auth) return;
    if (window.recaptchaVerifier) return;
    window.recaptchaVerifier = new RecaptchaVerifier(auth!, 'recaptcha-container', {
      size: 'invisible',
    });
  }, []);

  // ── Phone handlers ────────────────────────────────────────────────────────

  async function handleSendOtp() {
    if (!firebaseAuthEnabled || !auth) { setError('Firebase not configured'); return; }
    if (phone.length !== 10) { setError('Enter a valid 10-digit number'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPhoneNumber(auth!, `+91${phone}`, window.recaptchaVerifier!);
      confirmRef.current = result;
      setPhoneStep('otp');
    } catch (e: any) {
      setError(e.message?.replace('Firebase: ', '') ?? 'Failed to send OTP');
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!confirmRef.current) { setError('Session expired, resend OTP'); return; }
    if (otpCode.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const credential = await confirmRef.current.confirm(otpCode);
      const idToken = await credential.user.getIdToken();
      const res = await customerApi.verifyFirebaseToken(idToken, name || undefined);
      setAuth(res.token, res.customer);
    } catch (e: any) {
      const msg = e.message?.replace('Firebase: ', '') ?? 'Invalid OTP';
      setError(msg.includes('invalid-verification-code') ? 'Incorrect OTP, try again' : msg);
    } finally {
      setLoading(false);
    }
  }

  function handleResendOtp() {
    setPhoneStep('input');
    setOtpCode('');
    setError('');
    confirmRef.current = null;
    window.recaptchaVerifier?.clear();
    window.recaptchaVerifier = undefined;
    if (auth) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth!, 'recaptcha-container', { size: 'invisible' });
    }
  }

  // ── Email handlers ────────────────────────────────────────────────────────

  async function handleSendEmailOtp() {
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    setError('');
    setLoading(true);
    try {
      await customerApi.sendEmailOtp(email, name || undefined);
      setEmailStep('otp');
    } catch (e: any) {
      setError(e.message ?? 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyEmailOtp() {
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    if (emailCode.length !== 6) { setError('Enter the 6-digit code'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await customerApi.verifyEmailOtp(email, emailCode, name || undefined);
      setAuth(res.token, res.customer);
    } catch (e: any) {
      setError(e.message ?? 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  }

  function switchMethod(m: AuthMethod) {
    setMethod(m);
    setError('');
    setPhoneStep('input');
    setEmailStep('input');
    setEmailCode('');
    setOtpCode('');
  }

  return (
    <div style={styles.page}>
      <div id="recaptcha-container" />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoText}>PlatePe</span>
        </div>

        {tableNumber && <p style={styles.tableTag}>Table {tableNumber}</p>}

        <h1 style={styles.heading}>Welcome!</h1>
        <p style={styles.subtext}>Sign in to browse the menu and place your order</p>

        {/* Method toggle */}
        <div style={styles.toggle}>
          <button
            style={{ ...styles.toggleBtn, ...(method === 'phone' ? styles.toggleActive : {}) }}
            onClick={() => switchMethod('phone')}
          >
            📱 Phone
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(method === 'email' ? styles.toggleActive : {}) }}
            onClick={() => switchMethod('email')}
          >
            ✉️ Email
          </button>
        </div>

        {/* Name field (shown on first input step) */}
        {((method === 'phone' && phoneStep === 'input') || (method === 'email' && emailStep === 'input')) && (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>
              Your Name <span style={styles.optional}>(optional)</span>
            </label>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Raj"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}

        {/* ── Phone flow ── */}
        {method === 'phone' && (
          <>
            {phoneStep === 'input' ? (
              <>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Mobile Number</label>
                  <div style={styles.phoneRow}>
                    <span style={styles.phonePrefix}>+91</span>
                    <input
                      style={styles.phoneInput}
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="98XXXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    />
                  </div>
                </div>
                {error && <p style={styles.error}>{error}</p>}
                <button
                  style={{ ...styles.btn, opacity: loading || !firebaseAuthEnabled ? 0.65 : 1 }}
                  onClick={handleSendOtp}
                  disabled={loading || !firebaseAuthEnabled}
                >
                  {loading ? 'Sending…' : 'Send OTP via SMS'}
                </button>
              </>
            ) : (
              <>
                <p style={styles.sentNote}>OTP sent to +91 {phone}</p>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>6-digit OTP</label>
                  <input
                    style={styles.otpInput}
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    autoFocus
                  />
                </div>
                {error && <p style={styles.error}>{error}</p>}
                <button
                  style={{ ...styles.btn, opacity: loading ? 0.65 : 1 }}
                  onClick={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? 'Verifying…' : 'Verify & Continue'}
                </button>
                <button style={styles.linkBtn} onClick={handleResendOtp}>
                  Didn't receive? Resend OTP
                </button>
              </>
            )}
          </>
        )}

        {/* ── Email flow ── */}
        {method === 'email' && (
          <>
            {emailStep === 'input' ? (
              <>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    style={styles.input}
                    type="email"
                    inputMode="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendEmailOtp()}
                    autoFocus
                  />
                </div>
                {error && <p style={styles.error}>{error}</p>}
                <button
                  style={{ ...styles.btn, opacity: loading ? 0.65 : 1 }}
                  onClick={handleSendEmailOtp}
                  disabled={loading}
                >
                  {loading ? 'Sending…' : 'Send Email OTP'}
                </button>
              </>
            ) : (
              <>
                <p style={styles.sentNote}>Verification code sent to {email}</p>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>6-digit code</label>
                  <input
                    style={styles.otpInput}
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="• • • • • •"
                    value={emailCode}
                    onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyEmailOtp()}
                    autoFocus
                  />
                </div>
                {error && <p style={styles.error}>{error}</p>}
                <button
                  style={{ ...styles.btn, opacity: loading ? 0.65 : 1 }}
                  onClick={handleVerifyEmailOtp}
                  disabled={loading}
                >
                  {loading ? 'Verifying…' : 'Verify & Continue'}
                </button>
                <button
                  style={styles.linkBtn}
                  onClick={() => {
                    setEmailCode('');
                    setEmailStep('input');
                    setError('');
                  }}
                >
                  Send a new code
                </button>
              </>
            )}
          </>
        )}

        <p style={styles.poweredBy}>
          Phone via <span style={{ color: '#F57C00', fontWeight: 700 }}>Firebase</span>, email via secure OTP
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "var(--font-ui)",
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '36px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 40px rgba(196,98,45,0.10), 0 2px 8px rgba(0,0,0,0.06)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontFamily: "var(--font-ui)",
    fontSize: 26,
    fontWeight: 600,
    color: 'var(--accent)',
    letterSpacing: '-0.02em',
  },
  tableTag: {
    display: 'inline-block',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 'var(--radius)',
    marginBottom: 16,
  },
  heading: {
    fontFamily: "var(--font-ui)",
    fontSize: 28,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 6px',
    letterSpacing: '-0.02em',
  },
  subtext: { color: 'var(--text-2)', fontSize: 14, margin: '0 0 20px', lineHeight: 1.5 },
  toggle: {
    display: 'flex',
    gap: 8,
    background: 'var(--surface-2)',
    borderRadius: 'var(--radius-md)',
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    padding: '8px',
    border: 'none',
    borderRadius: 'var(--radius)',
    background: 'transparent',
    color: 'var(--text-2)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "var(--font-ui)",
    transition: 'all 0.15s',
  },
  toggleActive: {
    background: 'var(--surface)',
    color: 'var(--accent)',
    boxShadow: '0 1px 4px rgba(28,24,20,0.10)',
  },
  fieldGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 6,
    letterSpacing: '0.01em',
  },
  optional: { color: 'var(--text-3)', fontWeight: 400 },
  phoneRow: {
    display: 'flex',
    alignItems: 'stretch',
    border: '1.5px solid #DDD8D0',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    background: '#FAFAF8',
  },
  phonePrefix: {
    padding: '12px 14px',
    color: 'var(--text-2)',
    fontSize: 15,
    fontWeight: 500,
    background: 'var(--surface-2)',
    borderRight: '1.5px solid #DDD8D0',
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1,
    border: 'none',
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text)',
    background: 'transparent',
    outline: 'none',
    fontFamily: "var(--font-ui)",
    minWidth: 0,
  },
  input: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    fontSize: 15,
    color: 'var(--text)',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "var(--font-ui)",
    boxSizing: 'border-box',
  },
  otpInput: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    fontSize: 26,
    letterSpacing: '0.35em',
    textAlign: 'center',
    color: 'var(--text)',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "var(--font-ui)",
    boxSizing: 'border-box',
  },
  sentNote: {
    fontSize: 13,
    color: 'var(--text-2)',
    background: 'var(--surface-2)',
    borderRadius: 8,
    padding: '8px 12px',
    marginBottom: 16,
  },
  btn: {
    width: '100%',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: "var(--font-ui)",
    transition: 'opacity 0.15s',
  },
  linkBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 12,
    padding: '6px',
    fontFamily: "var(--font-ui)",
  },
  error: {
    color: 'var(--red)',
    fontSize: 13,
    margin: '0 0 8px',
    padding: '8px 12px',
    background: 'rgba(184,50,50,0.07)',
    borderRadius: 8,
  },
  poweredBy: {
    textAlign: 'center',
    color: 'var(--text-3)',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 0,
  },
};
