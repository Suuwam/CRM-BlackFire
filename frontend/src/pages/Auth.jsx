import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api';

export default function Auth({ onLogin }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token') || '';

  const [mode, setMode] = useState(resetToken ? 'reset' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [email, setEmail] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showError, setShowError] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(false);

  const fieldWrapRef = useRef(null);

  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function fail(msg) {
    setLoading(false);
    triggerShake();
    setErrorMsg(msg);
    setShowError(true);
    setInfoMsg('');
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      fail('Both username and password are required.');
      return;
    }
    setShowError(false);
    setLoading(true);
    onLogin({ username, password }).catch(() => {
      fail('Invalid account credentials.');
    });
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!email.trim()) {
      fail('Email is required.');
      return;
    }
    setShowError(false);
    setLoading(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setLoading(false);
      setInfoMsg('If that email is on file, a reset link has been sent.');
    } catch (err) {
      fail(err?.response?.data?.error || 'Could not send reset email.');
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (!resetToken) {
      fail('This reset link is missing a token.');
      return;
    }
    if (password !== confirm) {
      fail('Passwords do not match.');
      return;
    }
    setShowError(false);
    setLoading(true);
    try {
      await authApi.resetPassword({ token: resetToken, password });
      setLoading(false);
      setMode('login');
      setPassword('');
      setConfirm('');
      setInfoMsg('Password updated. You can sign in now.');
      navigate('/', { replace: true });
    } catch (err) {
      fail(err?.response?.data?.error || 'Could not reset password.');
    }
  }

  const title = mode === 'forgot' ? 'Reset Password' : mode === 'reset' ? 'Set New Password' : 'Account Login';
  const submitLabel = mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Ignite Access';
  const onSubmit = mode === 'forgot' ? handleForgot : mode === 'reset' ? handleReset : handleLogin;

  return (
    <div className="auth-page-root">
      <div className="grain"></div>

      <div className="stage">
        <svg className="sigil" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 4C32 4 20 18 20 32C20 42 25 48 25 48C22 44 22 38 25 34C25 40 29 44 32 46C29 40 30 34 34 30C33 36 37 40 41 42C38 38 38 32 41 27C42 33 46 36 46 42C46 51 40 60 32 60C22 60 14 52 14 40C14 24 32 4 32 4Z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>

        <h1 className="wordmark">Black Fire
          <span className="small">Artificial&nbsp;Intelligence</span>
        </h1>
        <p className="tagline">The gate remembers only one thing.</p>

        <form className="auth-card auth-login-card" onSubmit={onSubmit} autoComplete="off">
          <label className="field-label" htmlFor={mode === 'forgot' ? 'email' : mode === 'reset' ? 'new-password' : 'username'}>{title}</label>

          {mode === 'login' && (
            <>
              <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`} ref={fieldWrapRef}>
                <div className="field-inner">
                  <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4.2.3 2 -1 3.4-1 3.4.5-2-1-4-2.5-6-1 1.6-.5 3-1.5 4C10 8 12 5 12 2z"/>
                  </svg>
                  <input
                    type="text"
                    id="username"
                    className="pw"
                    placeholder="Username"
                    spellCheck="false"
                    autoComplete="off"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoFocus
                  />
                </div>
              </div>

              <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`} style={{ marginTop: 12 }}>
                <div className="field-inner">
                  <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4.2.3 2 -1 3.4-1 3.4.5-2-1-4-2.5-6-1 1.6-.5 3-1.5 4C10 8 12 5 12 2z"/>
                  </svg>
                  <input
                    type={visible ? 'text' : 'password'}
                    className="pw"
                    placeholder="Password"
                    spellCheck="false"
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => setVisible(v => !v)}
                    aria-label="Toggle password visibility"
                    title={visible ? 'Hide password' : 'Show password'}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={visible
                        ? 'M2 12c3-3 6-4 10-4s7 1 10 4c-3 3-6 4-10 4s-7-1-10-4z'
                        : 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z'}
                      />
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {mode === 'forgot' && (
            <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`}>
              <div className="field-inner">
                <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4h16v16H4z"/><path d="M4 7l8 6 8-6"/>
                </svg>
                <input
                  type="email"
                  id="email"
                  className="pw"
                  placeholder="Account email"
                  spellCheck="false"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`}>
                <div className="field-inner">
                  <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4.2.3 2 -1 3.4-1 3.4.5-2-1-4-2.5-6-1 1.6-.5 3-1.5 4C10 8 12 5 12 2z"/>
                  </svg>
                  <input
                    type={visible ? 'text' : 'password'}
                    id="new-password"
                    className="pw"
                    placeholder="New password"
                    autoComplete="new-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    autoFocus
                  />
                </div>
              </div>
              <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`} style={{ marginTop: 12 }}>
                <div className="field-inner">
                  <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4.2.3 2 -1 3.4-1 3.4.5-2-1-4-2.5-6-1 1.6-.5 3-1.5 4C10 8 12 5 12 2z"/>
                  </svg>
                  <input
                    type={visible ? 'text' : 'password'}
                    className="pw"
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                  />
                </div>
              </div>
            </>
          )}

          <div className={`error-msg${showError ? ' show' : ''}`}>
            {errorMsg}
          </div>
          {infoMsg && (
            <div className="auth-info-msg">{infoMsg}</div>
          )}

          <button type="submit" className="ignite" disabled={loading}>
            <span className="label">{submitLabel}</span>
            <span className="spinner"></span>
          </button>

          {mode === 'login' && (
            <button
              type="button"
              className="forgot-link"
              onClick={() => { setMode('forgot'); setShowError(false); setInfoMsg(''); }}
            >
              Forgot password?
            </button>
          )}

          {mode !== 'login' && (
            <button
              type="button"
              className="apply-toggle-btn"
              onClick={() => { setMode('login'); setShowError(false); setInfoMsg(''); navigate('/', { replace: true }); }}
            >
              Back to login
            </button>
          )}

          {mode === 'login' && (
            <button
              type="button"
              className="apply-toggle-btn"
              onClick={() => navigate('/apply')}
            >
              Apply for account
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
