import { useState, useRef } from 'react';

export default function Auth({ onLogin }) {
  const [pw, setPw]               = useState('');
  const [visible, setVisible]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState('');
  const [showError, setShowError] = useState(false);
  const [focused, setFocused]     = useState(false);
  const [shake, setShake]         = useState(false);

  const fieldWrapRef = useRef(null);

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!pw.trim()) {
      triggerShake();
      setErrorMsg('The gate needs a word to burn.');
      setShowError(true);
      return;
    }

    setShowError(false);
    setLoading(true);

    setTimeout(() => {
      const val = pw.trim().toLowerCase();
      if (val === 'blackfire' || val === 'aawazz') {
        sessionStorage.setItem('crm_auth', 'true');
        onLogin();
      } else {
        setLoading(false);
        triggerShake();
        setErrorMsg('The flame does not recognize this word.');
        setShowError(true);
      }
    }, 1000);
  }

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

        <form onSubmit={handleSubmit} autoComplete="off">
          <label className="field-label" htmlFor="pw">Passphrase</label>
          <div className={`field${focused ? ' focused' : ''}${shake ? ' shake' : ''}`} ref={fieldWrapRef}>
            <div className="field-inner">
              <svg className="flame-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0 0 10 0c0-1.7-.7-3-1.5-4.2.3 2 -1 3.4-1 3.4.5-2-1-4-2.5-6-1 1.6-.5 3-1.5 4C10 8 12 5 12 2z"/>
              </svg>
              <input
                type={visible ? 'text' : 'password'}
                id="pw"
                className="pw"
                placeholder="Enter the ember-word"
                spellCheck="false"
                value={pw}
                onChange={e => setPw(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setVisible(!visible)}
                aria-label="Toggle passphrase visibility"
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



          <div className={`error-msg${showError ? ' show' : ''}`}>
            {errorMsg}
          </div>

          <button type="submit" className={`ignite${loading ? ' loading' : ''}`} disabled={loading}>
            <span className="label">Ignite Access</span>
            <span className="spinner"></span>
          </button>
        </form>

        <p className="footer-note">Locked out? <a href="#" onClick={e => e.preventDefault()}>Whisper to the embers</a></p>
      </div>
    </div>
  );
}
