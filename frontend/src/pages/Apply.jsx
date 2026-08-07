import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useToast } from '../components/Toast';

export default function Apply() {
  const navigate = useNavigate();
  const toast = useToast();
  const verifyFormRef = useRef(null);

  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', note: '' });
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1); // 1 = Registration details, 2 = Verification code
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focusedField, setFocusedField] = useState('');

  async function handleRegister(e) {
    e.preventDefault();
    setErrorMsg('');

    if (!form.name.trim() || !form.email.trim() || !form.username.trim() || !form.password.trim()) {
      setErrorMsg('Name, email, username, and password are required.');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    // Password strength validation
    if (form.password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }
    const hasLetter = /[a-zA-Z]/.test(form.password);
    const hasNumber = /[0-9]/.test(form.password);
    if (!hasLetter || !hasNumber) {
      setErrorMsg('Password must contain at least one letter and one number.');
      return;
    }

    setLoading(true);
    try {
      await authApi.apply({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        note: form.note.trim()
      });
      if (typeof toast === 'function') toast('Verification code sent to your email', 'success');
      setStep(2);
    } catch (error) {
      setErrorMsg(error?.response?.data?.error || (typeof error?.response?.data === 'string' ? error.response.data : null) || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e?.preventDefault();
    setErrorMsg('');

    if (code.length !== 6) {
      setErrorMsg('Please enter the 6-digit code.');
      return;
    }

    setLoading(true);
    try {
      await authApi.verify({
        email: form.email.trim().toLowerCase(),
        code: code.trim()
      });
      if (typeof toast === 'function') toast('Email verified! Your request is now pending admin approval.', 'success');
      navigate('/');
    } catch (error) {
      setErrorMsg(error?.response?.data?.error || (typeof error?.response?.data === 'string' ? error.response.data : null) || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  }

  // Auto-submit when all 6 digits entered
  function handleCodeChange(e) {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCode(val);
    if (val.length === 6) {
      // Small delay so user sees full code before submission
      setTimeout(() => {
        if (verifyFormRef.current && typeof verifyFormRef.current.requestSubmit === 'function') {
          try {
            verifyFormRef.current.requestSubmit();
          } catch {
            handleVerify();
          }
        } else {
          handleVerify();
        }
      }, 200);
    }
  }

  return (
    <div className="auth-page-root">
      <div className="grain"></div>

      <div className="stage" style={{ width: '100%', maxWidth: 420 }}>
        <svg className="sigil" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4C32 4 20 18 20 32C20 42 25 48 25 48C22 44 22 38 25 34C25 40 29 44 32 46C29 40 30 34 34 30C33 36 37 40 41 42C38 38 38 32 41 27C42 33 46 36 46 42C46 51 40 60 32 60C22 60 14 52 14 40C14 24 32 4 32 4Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>

        <h1 className="wordmark">Black Fire
          <span className="small">Artificial&nbsp;Intelligence</span>
        </h1>

        {step === 1 ? (
          <>
            <p className="tagline">Request access to the CRM workspace.</p>

            <form className="auth-card" onSubmit={handleRegister} autoComplete="off" style={{ width: '100%' }}>
              <h2 className="auth-card-title" style={{ fontSize: '16px', marginBottom: '14px', textAlign: 'center' }}>Account Application</h2>

              {/* Name */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Full Name</label>
                <div className={`field${focusedField === 'name' ? ' focused' : ''}`}>
                  <div className="field-inner" style={{ height: '44px' }}>
                    <input
                      type="text" className="pw" style={{ fontSize: '14px' }}
                      placeholder="E.g. Shuvam"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Email Address</label>
                <div className={`field${focusedField === 'email' ? ' focused' : ''}`}>
                  <div className="field-inner" style={{ height: '44px' }}>
                    <input
                      type="email" className="pw" style={{ fontSize: '14px' }}
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Username</label>
                <div className={`field${focusedField === 'username' ? ' focused' : ''}`}>
                  <div className="field-inner" style={{ height: '44px' }}>
                    <input
                      type="text" className="pw" style={{ fontSize: '14px' }}
                      placeholder="username"
                      value={form.username}
                      onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      onFocus={() => setFocusedField('username')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Password</label>
                <div className={`field${focusedField === 'password' ? ' focused' : ''}`}>
                  <div className="field-inner" style={{ height: '44px' }}>
                    <input
                      type="password" className="pw" style={{ fontSize: '14px' }}
                      placeholder="Min 8 chars, letter & number"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField('')}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Access Note</label>
                <div className={`field${focusedField === 'note' ? ' focused' : ''}`} style={{ borderRadius: '6px' }}>
                  <textarea
                    className="pw"
                    style={{ fontSize: '14px', background: 'transparent', border: 'none', resize: 'vertical', width: '100%', minHeight: '60px', padding: '10px 14px', boxSizing: 'border-box' }}
                    placeholder="What projects will you work on?"
                    value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    onFocus={() => setFocusedField('note')}
                    onBlur={() => setFocusedField('')}
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="error-msg show" style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px' }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className={`ignite${loading ? ' loading' : ''}`} disabled={loading} style={{ marginTop: '16px', height: '46px' }}>
                <span className="label">{loading ? 'Sending...' : 'Submit Request'}</span>
                <span className="spinner"></span>
              </button>

              <button type="button" className="apply-toggle-btn" onClick={() => navigate('/')}>
                Back to Login
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="tagline">Check your inbox for the verification code.</p>

            <form ref={verifyFormRef} className="auth-card" onSubmit={handleVerify} autoComplete="off" style={{ width: '100%' }}>
              <h2 className="auth-card-title" style={{ fontSize: '16px', marginBottom: '6px', textAlign: 'center' }}>Email Verification</h2>
              <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginBottom: '20px' }}>
                A 6-digit code was sent to <strong style={{ color: 'var(--text)' }}>{form.email}</strong>.
                <br/>
                <span style={{ fontSize: '10px', color: '#555', marginTop: 4, display: 'block' }}>Enter the code below — it will submit automatically.</span>
              </p>

              {/* 6-digit OTP input */}
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="field-label" style={{ fontSize: '9px', marginBottom: '4px' }}>Verification Code</label>
                <div className={`field${focusedField === 'code' ? ' focused' : ''}`}>
                  <div className="field-inner" style={{ height: '56px' }}>
                    <input
                      type="text" inputMode="numeric" pattern="[0-9]*" className="pw"
                      style={{ fontSize: '26px', textAlign: 'center', letterSpacing: '10px', fontFamily: 'monospace', fontWeight: 700 }}
                      maxLength={6}
                      placeholder="— — — — — —"
                      value={code}
                      onChange={handleCodeChange}
                      onFocus={() => setFocusedField('code')}
                      onBlur={() => setFocusedField('')}
                      autoFocus
                      required
                    />
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="error-msg show" style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px' }}>
                  {errorMsg}
                </div>
              )}

              <button type="submit" className={`ignite${loading ? ' loading' : ''}`} disabled={loading} style={{ marginTop: '16px', height: '46px' }}>
                <span className="label">{loading ? 'Verifying...' : 'Verify Email'}</span>
                <span className="spinner"></span>
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', gap: 8 }}>
                <button type="button" className="apply-toggle-btn" style={{ flex: 1 }} onClick={() => { setStep(1); setCode(''); setErrorMsg(''); }}>
                  Edit Details
                </button>
                <button type="button" className="apply-toggle-btn" style={{ flex: 1 }} onClick={() => navigate('/')}>
                  Back to Login
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
