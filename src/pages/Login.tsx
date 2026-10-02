import React, { useState } from 'react';
import { login } from '../services/auth';
import type { UserClaims } from '../types';
import { Logo } from '../components/Logo';
import { useSystemInfo } from '../context/SystemContext';

interface LoginProps {
  onLoginSuccess: (user: UserClaims) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { systemInfo } = useSystemInfo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
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
            {isLoading ? (
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            ) : null}
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
