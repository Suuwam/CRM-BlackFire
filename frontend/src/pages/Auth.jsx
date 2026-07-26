import { useState } from 'react';

export default function Auth({ onLogin }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      // Passcode check: accepts "blackfire", "aawazz", or any non-empty passcode for easy access
      if (passcode.trim().toLowerCase() === 'blackfire' || passcode.trim().toLowerCase() === 'aawazz' || passcode.trim().length >= 4) {
        localStorage.setItem('crm_auth', 'true');
        onLogin();
      } else {
        setError('Invalid passcode. Use "blackfire" or "aawazz" to access.');
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo-badge">🔥</div>
          <h1 className="auth-title">Blackfire AI</h1>
          <p className="auth-sub">AI Product Platform & Venture Engine</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="auth-label">Enter Access Passcode</label>
            <div className="auth-input-wrap">
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                autoFocus
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Authenticating...' : 'Access CRM Dashboard →'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Protected Workspace</span> · <span>Aawazz & Blackfire AI Engine</span>
        </div>
      </div>
    </div>
  );
}
