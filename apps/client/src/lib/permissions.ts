import { getUserRole } from './auth';

// Local role definitions for client-side use
enum Role {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
  Operation = 'operation',
}

export type Permission = 'create' | 'edit' | 'delete' | 'view' |'operate';

export function hasPermission(permission: Permission): boolean {
  const userRole = getUserRole();
  
  switch (userRole) {
    case Role.Admin:
      return true; // Admins can do everything
    case Role.Editor:
      return permission !== 'delete'; // Editors can create, edit, view but not delete
    case Role.Viewer:
      return permission === 'view'; // Viewers can only view
    case Role.Operation:
      return permission === 'view' || permission === 'operate';
    default:
      return false;
  }
}

export function canCreate(): boolean {
  return hasPermission('create');
}

export function canEdit(): boolean {
  return hasPermission('edit');
}

export function canDelete(): boolean {
  return hasPermission('delete');
}

export function canView(): boolean {
  return hasPermission('view');
}
export function canOperate(): boolean {
  return hasPermission('operate');
}
// Specific permission checks for different features
export function canManageUsers(): boolean {
  const userRole = getUserRole();
  
  switch (userRole) {
    case Role.Admin:
      return true;
    case Role.Editor:
      return false;
    case Role.Viewer:
      return false;
    case  Role.Operation:
      return false;
    default:
      return false;
  }
}

export function canManageProviders(): boolean {
  const userRole = getUserRole();
  
  switch (userRole) {
    case Role.Admin:
      return true;
    case Role.Editor:
      return true;
    case Role.Viewer:
      return false;
    case Role.Operation:
      return false;
    default:
      return false;
  }
}

export function canViewServices(): boolean {
  const userRole = getUserRole();
  
  switch (userRole) {
    case Role.Admin:
      return true;
    case Role.Editor:
      return true;
    case Role.Viewer:
      return true;
    case Role.Operation:
      return true;
    default:
      return false;
  }
}

export function canManageIntegrations(): boolean {
  return getUserRole() === Role.Admin;
}

export function canManageServices(): boolean {
  return hasPermission('create') || hasPermission('edit');
}

export function canManageTags(): boolean {
  return hasPermission('create') || hasPermission('edit');
} 