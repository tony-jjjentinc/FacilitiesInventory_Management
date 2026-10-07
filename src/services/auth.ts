/**
 * @file auth.ts
 * @description Client-side session and authentication service integrated with JJJEI AuthLib JWTs.
 */

import type { UserClaims } from '../types';
import { apiRequest } from './api';

const TOKEN_KEY = 'jjjei_jwt_token';

/**
 * Decodes a base64url string to utf-8 text.
 */
function base64UrlDecode(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0: break;
    case 2: output += '=='; break;
    case 3: output += '='; break;
    default: throw new Error('Illegal base64url string!');
  }
  return decodeURIComponent(
    atob(output)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

/**
 * Parses JWT claims from token string.
 */
export function parseTokenClaims(token: string): UserClaims | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) {
      // Mock tokens are honoured in dev builds only
      if (!import.meta.env.DEV) return null;
      return {
        id: 'DEV-USER-001',
        name: 'Facilities Administrator',
        email: 'admin.facilities@jjjei.com',
        roles: ['Super Admin', 'Head'],
        department: ['Facilities'],
        exp: Date.now() + 36000000
      };
    }
    const payloadJson = base64UrlDecode(parts[1]);
    return JSON.parse(payloadJson) as UserClaims;
  } catch (err) {
    console.error('Error parsing token claims:', err);
    return null;
  }
}

/**
 * Retrieves the stored JWT from sessionStorage or localStorage.
 */
export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.warn('[Auth] Error accessing storage:', err);
    return null;
  }
}

/**
 * Stores the token according to the user's preference.
 */
export function setStoredToken(token: string, rememberMe: boolean): void {
  try {
    if (rememberMe) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('[Auth] Error writing token to storage:', err);
  }
}

/**
 * Purges the JWT from all browser storage mechanisms.
 */
export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.warn('[Auth] Error clearing storage:', err);
  }
}

/**
 * Authenticates user via AuthLib endpoint and stores JWT in session/local storage.
 */
export async function login(email: string, password: string, rememberMe = false): Promise<UserClaims> {
  const result = await apiRequest<{ token: string }>('auth:login', { email, password });
  const token = result.token;
  setStoredToken(token, rememberMe);

  const claims = parseTokenClaims(token);
  if (!claims) {
    throw new Error('Failed to parse authenticated session claims.');
  }
  return claims;
}

/**
 * Clears authenticated session from all storage.
 */
export function logout(): void {
  clearStoredToken();
}

/**
 * Retrieves the currently active user claims, or null if unauthenticated/expired.
 */
export function getCurrentUser(): UserClaims | null {
  const token = getStoredToken();
  if (!token) return null;

  const claims = parseTokenClaims(token);
  if (!claims) {
    logout();
    return null;
  }

  // Check expiration
  if (claims.exp) {
    const expMs = claims.exp < 1e12 ? claims.exp * 1000 : claims.exp;
    if (Date.now() > expMs) {
      logout();
      return null;
    }
  }

  return claims;
}

/**
 * Asserts whether the active user possesses at least one of the specified roles.
 */
export function hasAnyRole(requiredRoles: string[]): boolean {
  const user = getCurrentUser();
  if (!user || !user.roles) return false;
  if (user.roles.includes('Super Admin')) return true;

  return requiredRoles.some(req =>
    user.roles.some(r => typeof r === 'string' && r.trim().toLowerCase() === req.trim().toLowerCase())
  );
}

/**
 * Checks if the user has Super Admin or Head administrative privileges.
 */
export function isUserHeadOrAdmin(user: UserClaims | null): boolean {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some(
    r => typeof r === 'string' && ['super admin', 'head'].includes(r.trim().toLowerCase())
  );
}
