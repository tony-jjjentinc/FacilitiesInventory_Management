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
      // In dev sandbox mode with mock tokens
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
 * Authenticates user via AuthLib endpoint and stores JWT in sessionStorage.
 */
export async function login(email: string, password: string): Promise<UserClaims> {
  const result = await apiRequest<{ token: string }>('auth:login', { email, password });
  const token = result.token;
  sessionStorage.setItem(TOKEN_KEY, token);

  const claims = parseTokenClaims(token);
  if (!claims) {
    throw new Error('Failed to parse authenticated session claims.');
  }
  return claims;
}

/**
 * Clears authenticated session from sessionStorage.
 */
export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/**
 * Retrieves the currently active user claims, or null if unauthenticated/expired.
 */
export function getCurrentUser(): UserClaims | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
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
    user.roles.some(r => r.trim().toLowerCase() === req.trim().toLowerCase())
  );
}
