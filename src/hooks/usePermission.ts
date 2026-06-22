import * as React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../lib/firebaseClient';

export enum Permission {
  CREATE_PRODUCT = 'CREATE_PRODUCT',
  READ_PRODUCT = 'READ_PRODUCT',
  UPDATE_PRODUCT = 'UPDATE_PRODUCT',
  DELETE_PRODUCT = 'DELETE_PRODUCT',

  CREATE_SALE = 'CREATE_SALE',
  READ_SALE = 'READ_SALE',
  MODIFY_SALE = 'MODIFY_SALE',
  DELETE_SALE = 'DELETE_SALE',

  VIEW_ACCOUNTING = 'VIEW_ACCOUNTING',
  MODIFY_ACCOUNTING = 'MODIFY_ACCOUNTING',
  VIEW_REPORTS = 'VIEW_REPORTS',
  EXPORT_REPORTS = 'EXPORT_REPORTS',

  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_ROLES = 'MANAGE_ROLES',

  MODIFY_SETTINGS = 'MODIFY_SETTINGS',
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    ...Object.values(Permission),
  ],
  owner: [
    ...Object.values(Permission),
  ],
  developer: [
    ...Object.values(Permission),
  ],
  manager: [
    Permission.READ_PRODUCT,
    Permission.CREATE_PRODUCT,
    Permission.UPDATE_PRODUCT,
    Permission.CREATE_SALE,
    Permission.READ_SALE,
    Permission.MODIFY_SALE,
    Permission.VIEW_ACCOUNTING,
    Permission.VIEW_REPORTS,
    Permission.MANAGE_USERS,
  ],
  staff: [
    Permission.READ_PRODUCT,
    Permission.CREATE_SALE,
    Permission.READ_SALE,
  ],
  cashier: [
    Permission.READ_PRODUCT,
    Permission.CREATE_SALE,
    Permission.READ_SALE,
  ],
  accountant: [
    Permission.READ_PRODUCT,
    Permission.VIEW_ACCOUNTING,
    Permission.MODIFY_ACCOUNTING,
    Permission.VIEW_REPORTS,
  ],
};

export function usePermission() {
  const { user } = useAuth();
  const [roleName, setRoleName] = useState<string>('staff');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setRoleName('staff');
      setLoading(false);
      return;
    }

    const userId = user.$id;
    let isMounted = true;

    async function loadUserRole() {
      try {
        setLoading(true);
        // Look up the business_users table linkage
        const { data: userLink, error: linkErr } = await supabase
          .from('business_users')
          .select('role_id')
          .eq('user_id', userId)
          .single();

        if (linkErr || !userLink) {
          if (isMounted) {
            setRoleName('staff');
            setLoading(false);
          }
          return;
        }

        if (userLink.role_id) {
          // Look up full role name definition
          const { data: roleDef, error: roleErr } = await supabase
            .from('roles')
            .select('name')
            .eq('id', userLink.role_id)
            .single();

          if (!roleErr && roleDef?.name && isMounted) {
            const rawName = roleDef.name.toLowerCase();
            if (rawName.includes('admin') || rawName.includes('owner') || rawName.includes('developer')) {
              setRoleName('admin');
            } else if (rawName.includes('manager')) {
              setRoleName('manager');
            } else if (rawName.includes('account')) {
              setRoleName('accountant');
            } else if (rawName.includes('cashier')) {
              setRoleName('cashier');
            } else {
              setRoleName('staff');
            }
          }
        }
      } catch (err) {
        console.error('[RBAC] Error fetching user permissions', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUserRole();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const can = (permission: Permission): boolean => {
    if (!user) return false;
    // Superadmin override
    if (user.email?.toLowerCase() === 'tapsforex@gmail.com' || user.email?.toLowerCase() === 'tapiwagahadza54@gmail.com') {
      return true;
    }
    const permissions = ROLE_PERMISSIONS[roleName] || ROLE_PERMISSIONS['staff'];
    return permissions.includes(permission);
  };

  const canAll = (permissions: Permission[]): boolean => {
    return permissions.every(p => can(p));
  };

  const canAny = (permissions: Permission[]): boolean => {
    return permissions.some(p => can(p));
  };

  return {
    role: roleName,
    loading,
    can,
    canAll,
    canAny,
  };
}

interface ProtectedActionProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedAction({ permission, children, fallback }: ProtectedActionProps) {
  const { can, loading } = usePermission();

  if (loading) {
    return null; // or stable loader
  }

  if (!can(permission)) {
    return fallback ? React.createElement(React.Fragment, null, fallback) : null;
  }

  return React.createElement(React.Fragment, null, children);
}
