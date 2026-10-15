import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useMemo, 
  type ReactNode 
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';
import { supabase } from './supabase';
import { toast } from 'sonner';

// --- Configuration & Constants ---
const SECURITY_HEARTBEAT_TTL_MS = 72 * 60 * 60 * 1000; // 72-hour offline GDPR limit
const HEARTBEAT_STORAGE_KEY = 'strixos_last_auth_heartbeat';
const HEARTBEAT_CHECK_INTERVAL_MS = 60 * 1000; // Evaluate expiration every minute
const AUTH_SESSION_KEY = 'strix-auth-session';

export interface UserProfile {
  id: string;
  name: string | null;
  initials: string | null;
  pin: string | null;
  role: string | null;
  avatar_url?: string;
  phone?: string;
  emergency_contact_phone?: string;
  is_active?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isLocked: boolean;
  hasPermission: (permission: string | string[], showToastOnDenied?: boolean) => boolean;
  checkAccess: (allowedRoles: string[]) => boolean;
  lockSession: () => void;
  unlockSession: (pinCode: string) => boolean;
  logout: (isExpired?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Normalizes role strings: "Senior Volunteer" -> "SENIOR_VOLUNTEER"
function normalizeRole(role?: string | null): string {
  if (!role) return 'ANONYMOUS';
  return role.trim().toUpperCase().replace(/\s+/g, '_');
}

// ------------------------------------------------------------------
// 1. RBAC PERMISSIONS QUERY (Role Baseline + Individual Overrides)
// ------------------------------------------------------------------
export const getPermissionsQueryOptions = (role?: string | null, userId?: string | null) => {
  const normalizedRole = normalizeRole(role);

  return queryOptions({
    queryKey: ['rbac_permissions', normalizedRole, userId || 'none'],
    queryFn: async () => {
      if (!role) return [];

      // DIRECTORS and ADMINS hold unrestricted root wildcard clearance (*)
      if (normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR') {
        return ['*'];
      }

      // Parallel fetch: Role baseline and individual user overrides
      const [roleRes, overrideRes] = await Promise.all([
        supabase
          .from('rbac_role_permissions')
          .select('permission_key')
          .eq('role', normalizedRole),
        userId
          ? supabase
              .from('user_permission_overrides')
              .select('permission_key, is_granted')
              .eq('user_id', userId)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (roleRes.error) {
        console.warn('[RBAC Role Query Notice]:', roleRes.error.message);
      }
      if (overrideRes.error) {
        console.warn('[RBAC Overrides Query Notice]:', overrideRes.error.message);
      }

      const effectiveSet = new Set<string>((roleRes.data || []).map((r) => r.permission_key));

      // Apply individual grants and revokes
      (overrideRes.data || []).forEach((ov: { permission_key: string; is_granted: boolean }) => {
        if (ov.is_granted) {
          effectiveSet.add(ov.permission_key);
        } else {
          effectiveSet.delete(ov.permission_key);
        }
      });

      return Array.from(effectiveSet);
    },
    enabled: Boolean(role),
    networkMode: 'offlineFirst',
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 24 * 14,
    meta: { persist: true },
  });
};

// ------------------------------------------------------------------
// 2. USER PROFILE QUERY
// ------------------------------------------------------------------
export const getUserProfileQueryOptions = (userId?: string | null) => queryOptions({
  queryKey: ['userProfile', userId],
  queryFn: async () => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('users')
      .select('id, name, initials, pin, role, avatar_url, phone, is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[UserProfile Query Notice]:', error.message);
      const cached = await get('strix-user-profile');
      return (cached || null) as UserProfile | null;
    }

    if (data) {
      await set('strix-user-profile', data);
    }
    return data as UserProfile;
  },
  enabled: Boolean(userId),
  networkMode: 'offlineFirst',
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 60 * 24 * 14,
  meta: { persist: true },
});

// ------------------------------------------------------------------
// 3. AUTH PROVIDER COMPONENT
// ------------------------------------------------------------------
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  const logout = useCallback(async (isExpired = false) => {
    await supabase.auth.signOut().catch(() => {});
    await del(AUTH_SESSION_KEY);
    await del('strix-user-profile');
    localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
    localStorage.removeItem('strix-is-locked');
    
    queryClient.clear();
    setSession(null);
    setUser(null);

    if (isExpired) {
      toast.error('Security session expired (72h offline limit reached). Logged out for data protection.');
    }
  }, [queryClient]);

  // Evaluates whether the device has exceeded 72 hours offline without server validation
  const evaluateSecurityHeartbeat = useCallback(() => {
    const rawHeartbeat = localStorage.getItem(HEARTBEAT_STORAGE_KEY);
    const now = Date.now();

    if (navigator.onLine) {
      localStorage.setItem(HEARTBEAT_STORAGE_KEY, now.toString());
      return;
    }

    if (rawHeartbeat) {
      const lastHeartbeat = parseInt(rawHeartbeat, 10);
      if (now - lastHeartbeat > SECURITY_HEARTBEAT_TTL_MS) {
        logout(true);
      }
    } else {
      localStorage.setItem(HEARTBEAT_STORAGE_KEY, now.toString());
    }
  }, [logout]);

  // Auth Initialization & Realtime Subscription
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session: nativeSession } } = await supabase.auth.getSession();
        let activeSession = nativeSession;
        
        if (!activeSession) {
          const cachedSession = await get(AUTH_SESSION_KEY);
          if (cachedSession) {
            await supabase.auth.setSession(cachedSession);
            activeSession = cachedSession;
          }
        }

        if (isMounted) {
          setSession(activeSession ?? null);
          setUser(activeSession?.user ?? null);
          
          if (activeSession?.user) {
            evaluateSecurityHeartbeat();
          }
        }
      } catch (error) {
        console.error('[Auth Engine] Initialization failed:', error);
      } finally {
        if (isMounted) setIsSessionLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await set(AUTH_SESSION_KEY, newSession);
        localStorage.setItem(HEARTBEAT_STORAGE_KEY, Date.now().toString());
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        await del(AUTH_SESSION_KEY);
        await del('strix-user-profile');
        localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
        localStorage.removeItem('strix-is-locked');
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient, evaluateSecurityHeartbeat]);

  // 72-Hour Security Heartbeat Listeners
  useEffect(() => {
    if (!user) return;

    evaluateSecurityHeartbeat();

    const interval = setInterval(evaluateSecurityHeartbeat, HEARTBEAT_CHECK_INTERVAL_MS);
    const handleOnline = () => evaluateSecurityHeartbeat();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        evaluateSecurityHeartbeat();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, evaluateSecurityHeartbeat]);

  // Query Profile & Effective RBAC Permissions
  const { data: profile, status: profileStatus } = useQuery(getUserProfileQueryOptions(user?.id));
  const { data: rawPermissions = [] } = useQuery(
    getPermissionsQueryOptions(profile?.role, user?.id)
  );

  const activePermissionsSet = useMemo(() => {
    const set = new Set<string>();
    rawPermissions.forEach((p: string) => {
      if (!p) return;
      const trimmed = p.trim();
      set.add(trimmed);
      const lower = trimmed.toLowerCase();
      set.add(lower);

      if (lower.startsWith('voucher:')) {
        set.add(lower.replace('voucher:', 'vouchers:'));
      } else if (lower.startsWith('vouchers:')) {
        set.add(lower.replace('vouchers:', 'voucher:'));
      }
    });
    return set;
  }, [rawPermissions]);

  // Permission Verification (Wildcard * & Root Bypass)
  const hasPermission = useCallback((permission: string | string[], showToastOnDenied = false): boolean => {
    if (profileStatus === 'pending') return false; 
    if (!profile && !session) return false;

    const normalizedRole = normalizeRole(profile?.role || session?.user?.user_metadata?.role);
    const isRootRole = normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR';
    
    // Director & Admin bypass everything unconditionally
    if (isRootRole || activePermissionsSet.has('*')) return true;

    const checkSingle = (perm: string): boolean => {
      if (!perm) return false;
      const trimmed = perm.trim();
      const lower = trimmed.toLowerCase();

      return (
        activePermissionsSet.has(trimmed) ||
        activePermissionsSet.has(lower) ||
        (lower.startsWith('vouchers:') && activePermissionsSet.has(lower.replace('vouchers:', 'voucher:'))) ||
        (lower.startsWith('voucher:') && activePermissionsSet.has(lower.replace('voucher:', 'vouchers:')))
      );
    };

    const allowed = Array.isArray(permission)
      ? permission.some(checkSingle)
      : checkSingle(permission);

    if (!allowed && showToastOnDenied) {
      toast.error('Unauthorized Access');
    }

    return allowed;
  }, [profile, session, profileStatus, activePermissionsSet]);

  const checkAccess = useCallback((allowedRoles: string[]): boolean => {
    if (!profile) return false;
    const normalizedRole = normalizeRole(profile.role);
    if (normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR') return true;
    return allowedRoles.map((r) => normalizeRole(r)).includes(normalizedRole);
  }, [profile]);

  const isFullyLoading = isSessionLoading || (Boolean(user) && profileStatus === 'pending');

  const contextValue = useMemo(() => ({
    session,
    user,
    profile: profile || null,
    isLoading: isFullyLoading,
    isLocked: false,
    hasPermission,
    checkAccess,
    lockSession: () => {},
    unlockSession: () => true,
    logout: () => logout(false),
    signOut: () => logout(false),
  }), [session, user, profile, isFullyLoading, hasPermission, checkAccess, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;