import React, { useEffect, useState } from 'react';
import { login } from '../services/auth';
import type { UserClaims } from '../types';
import { Logo } from '../components/Logo';
import { useSystemInfo } from '../context/SystemContext';
import { Loading } from '../components/Loading';

interface LoginProps {
  onLoginSuccess: (user: UserClaims) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { systemInfo } = useSystemInfo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [slow, setSlow] = useState(false); // the Apps Script backend can take 10s+ to wake up
  useEffect(() => {
    if (!isLoading) { setSlow(false); return; }
    const t = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(t);
  }, [isLoading]);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const user = await login(email, password, rememberMe);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-primary-subtle p-3">
      <div className="card border shadow-sm p-3 p-md-4" style={{ maxWidth: '670px', width: '100%', borderRadius: '8px' }}>
        <div className="text-center mb-4">
          <Logo size={96} variant="default" className="mb-3" />
          <h6 className="fw-bold mb-1 text-dark">{systemInfo.name}</h6>
          <div className="d-flex align-items-center justify-content-center gap-2 small text-muted">
            <span>{systemInfo.subtitle}</span>
            <span>{systemInfo.version}</span>
          </div>
        </div>

        {errorMessage && (
          <div className="alert alert-danger py-2 px-3 small mb-3" role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label small text-muted mb-1">Email</label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted mb-1">Password</label>
            <div className="position-relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control pe-5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-link text-muted position-absolute top-50 end-0 translate-middle-y py-0 px-3 border-0 shadow-none"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()} // clicking must not pull focus out of the password field
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          <div className="mb-4 d-flex justify-content-between align-items-center">
            <div className="form-check mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="rememberMeCheckbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label className="form-check-label small text-muted user-select-none" htmlFor="rememberMeCheckbox">
                Remember me
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100 py-2 fw-medium"
            disabled={isLoading}
          >
            {isLoading ? <Loading variant="button" label={slow ? 'Waking up the server...' : 'Signing in...'} typewriter={false} /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
