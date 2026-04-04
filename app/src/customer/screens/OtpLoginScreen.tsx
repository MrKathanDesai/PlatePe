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

export default function OtpLoginScreen() {
  const { setAuth, tableNumber } = useCustomer();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  // Set up invisible reCAPTCHA once
  useEffect(() => {
    if (!firebaseAuthEnabled || !auth) return;
    if (window.recaptchaVerifier) return;
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
    });
  }, []);

  async function handleSendOtp() {
    if (!firebaseAuthEnabled || !auth) {
      setError('Customer OTP login is not configured for this environment.');
      return;
    }
    if (phone.length !== 10) { setError('Enter a valid 10-digit number'); return; }
    setError('');
    setLoading(true);
    try {
      const appVerifier = window.recaptchaVerifier!;
      const result = await signInWithPhoneNumber(auth, `+91${phone}`, appVerifier);
      confirmRef.current = result;
      setStep('otp');
    } catch (e: any) {
      setError(e.message?.replace('Firebase: ', '') ?? 'Failed to send OTP');
      // Reset reCAPTCHA on error so user can retry
      window.recaptchaVerifier?.clear();
      window.recaptchaVerifier = undefined;
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (!firebaseAuthEnabled || !auth) {
      setError('Customer OTP login is not configured for this environment.');
      return;
    }
    if (code.length !== 6) { setError('Enter the 6-digit OTP'); return; }
    if (!confirmRef.current) { setError('Session expired, resend OTP'); return; }
    setError('');
    setLoading(true);
    try {
      const credential = await confirmRef.current.confirm(code);
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

  function handleResend() {
    if (!firebaseAuthEnabled || !auth) {
      setError('Customer OTP login is not configured for this environment.');
      return;
    }
    setStep('phone');
    setCode('');
    setError('');
    confirmRef.current = null;
    window.recaptchaVerifier?.clear();
    window.recaptchaVerifier = undefined;
    // Re-init reCAPTCHA
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
  }

  return (
    <div style={styles.page}>
      {/* Invisible reCAPTCHA anchor */}
      <div id="recaptcha-container" ref={recaptchaContainerRef} />

      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🍽</span>
          <span style={styles.logoText}>PlatePe</span>
        </div>

        {tableNumber && (
          <p style={styles.tableTag}>Table {tableNumber}</p>
        )}

        <h1 style={styles.heading}>
          {step === 'phone' ? 'Welcome!' : 'Enter OTP'}
        </h1>
        <p style={styles.subtext}>
          {step === 'phone'
            ? 'Sign in with your mobile number to order'
            : `OTP sent to +91 ${phone}`}
        </p>

        {!firebaseAuthEnabled && (
          <p style={styles.error}>
            Customer OTP login is unavailable because Firebase web credentials are not configured.
          </p>
        )}

        {step === 'phone' ? (
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

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{ ...styles.btn, opacity: loading ? 0.65 : 1 }}
              onClick={handleSendOtp}
              disabled={loading || !firebaseAuthEnabled}
            >
              {loading ? 'Sending…' : 'Send OTP via SMS'}
            </button>
          </>
        ) : (
          <>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>6-digit OTP</label>
              <input
                style={styles.otpInput}
                type="tel"
                inputMode="numeric"
                maxLength={6}
                placeholder="• • • • • •"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                autoFocus
              />
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{ ...styles.btn, opacity: loading ? 0.65 : 1 }}
              onClick={handleVerifyOtp}
              disabled={loading || !firebaseAuthEnabled}
            >
              {loading ? 'Verifying…' : 'Verify & Continue'}
            </button>

            <button style={styles.linkBtn} onClick={handleResend} disabled={!firebaseAuthEnabled}>
              Didn't receive? Resend OTP
            </button>
          </>
        )}

        <p style={styles.poweredBy}>
          Phone verification by{' '}
          <span style={{ color: '#F57C00', fontWeight: 700 }}>Firebase</span>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg, #FFF8F2 0%, #FFF0E4 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 24,
    padding: '36px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 8px 40px rgba(196,98,45,0.10), 0 2px 8px rgba(0,0,0,0.06)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoIcon: { fontSize: 28 },
  logoText: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 26,
    fontWeight: 600,
    color: '#C4622D',
    letterSpacing: '-0.02em',
  },
  tableTag: {
    display: 'inline-block',
    background: 'rgba(196,98,45,0.09)',
    color: '#C4622D',
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 100,
    marginBottom: 16,
  },
  heading: {
    fontFamily: "'Fraunces', Georgia, serif",
    fontSize: 28,
    fontWeight: 600,
    color: '#1C1814',
    margin: '0 0 6px',
    letterSpacing: '-0.02em',
  },
  subtext: { color: '#5C5650', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 },
  fieldGroup: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#1C1814',
    marginBottom: 6,
    letterSpacing: '0.01em',
  },
  optional: { color: '#A09890', fontWeight: 400 },
  phoneRow: {
    display: 'flex',
    alignItems: 'stretch',
    border: '1.5px solid #DDD8D0',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#FAFAF8',
  },
  phonePrefix: {
    padding: '12px 14px',
    color: '#5C5650',
    fontSize: 15,
    fontWeight: 500,
    background: '#F3EFE8',
    borderRight: '1.5px solid #DDD8D0',
    flexShrink: 0,
  },
  phoneInput: {
    flex: 1,
    border: 'none',
    padding: '12px 14px',
    fontSize: 15,
    color: '#1C1814',
    background: 'transparent',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    minWidth: 0,
  },
  input: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 15,
    color: '#1C1814',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    boxSizing: 'border-box',
  },
  otpInput: {
    width: '100%',
    border: '1.5px solid #DDD8D0',
    borderRadius: 12,
    padding: '14px',
    fontSize: 26,
    letterSpacing: '0.35em',
    textAlign: 'center',
    color: '#1C1814',
    background: '#FAFAF8',
    outline: 'none',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    background: '#C4622D',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    transition: 'opacity 0.15s',
  },
  linkBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#C4622D',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: 12,
    padding: '6px',
    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  error: {
    color: '#B83232',
    fontSize: 13,
    margin: '0 0 8px',
    padding: '8px 12px',
    background: 'rgba(184,50,50,0.07)',
    borderRadius: 8,
  },
  poweredBy: {
    textAlign: 'center',
    color: '#A09890',
    fontSize: 12,
    marginTop: 20,
    marginBottom: 0,
  },
};
