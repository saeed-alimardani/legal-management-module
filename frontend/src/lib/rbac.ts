import type { UserRole, AuthUser } from './types';

const ADMIN: UserRole[] = ['LEGAL_ADMIN'];
const ADMIN_MANAGER: UserRole[] = ['LEGAL_ADMIN', 'LEGAL_MANAGER'];
const MATTER_CONTENT_CREATORS: UserRole[] = [
  'LEGAL_ADMIN',
  'LEGAL_MANAGER',
  'LEGAL_COUNSEL',
];

/** Admin and manager may create/edit cases, contracts, notices, tasks, deadlines. */
export function canManageCoreEntities(role: UserRole): boolean {
  return ADMIN_MANAGER.includes(role);
}

/** Counsel may add documents, discussions, deadlines, reminders, and financial records on accessible matters. */
export function canCreateMatterContent(role: UserRole): boolean {
  return MATTER_CONTENT_CREATORS.includes(role);
}

/** @deprecated Use canManageCoreEntities for core entities. */
export function canMutate(role: UserRole): boolean {
  return canManageCoreEntities(role);
}

export function canDeleteOrReassign(role: UserRole): boolean {
  return ADMIN_MANAGER.includes(role);
}

export function canManageUsers(role: UserRole): boolean {
  return ADMIN.includes(role);
}

export function canProcessReminders(role: UserRole): boolean {
  return ADMIN_MANAGER.includes(role);
}

export function canOffboard(role: UserRole): boolean {
  return ADMIN.includes(role);
}

export function canViewActivityLogs(role: UserRole): boolean {
  return ADMIN.includes(role);
}

/** Admin/manager, or counsel editing a record they created. */
export function canEditCreatedResource(
  user: AuthUser,
  createdById: string | undefined,
): boolean {
  if (canManageCoreEntities(user.role)) {
    return true;
  }

  return user.role === 'LEGAL_COUNSEL' && createdById === user.id;
}

export function roleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    LEGAL_ADMIN: 'Admin',
    LEGAL_MANAGER: 'Manager',
    LEGAL_COUNSEL: 'Counsel',
    VIEWER: 'Viewer',
  };
  return labels[role];
}
