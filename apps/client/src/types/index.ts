// Client-side type definitions
export enum Role {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
  Operation = 'operation',
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
} 