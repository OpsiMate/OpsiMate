// Client-side type definitions
export enum Role {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
  NOC = 'noc',
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
} 