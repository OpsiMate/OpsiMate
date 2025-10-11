import { jwtDecode } from 'jwt-decode';

export interface JWTPayload {
  id: number;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  iat: number;
  exp: number;
}

export function getCurrentUser(): JWTPayload | null {
  const token = localStorage.getItem('jwt');
  if (!token) return null;
  
  try {
    return jwtDecode<JWTPayload>(token);
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

export function isAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

export function isEditor(): boolean {
  const user = getCurrentUser();
  return user?.role !== 'viewer';
}

export function  isViewer(): boolean{
  const user = getCurrentUser();
  return user?.role ==='viewer';
}

export function getUserRole(): 'admin' | 'editor' | 'viewer' | null {
  const user = getCurrentUser();
  return user?.role || null;
} 