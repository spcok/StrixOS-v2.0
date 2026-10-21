import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { useQuery, useQueryClient, queryOptions } from '@tanstack/react-query';
import { get, set, del } from 'idb-keyval';
import { toast } from 'sonner';
import { supabase } from './supabase';

const SECURITY_HEARTBEAT_TTL_MS = 72 * 60 * 60 * 1000; // 72-hour offline GDPR limit
const IDLE_SOFT_LOCK_MS = 5 * 60 * 1000; // 5-minute shared tablet soft-lock
const MAX_PIN_ATTEMPTS = 5;
const HEARTBEAT_STORAGE_KEY = 'strixos_last_auth_heartbeat';
const HEARTBEAT_CHECK_INTERVAL_MS = 60 * 1000;
const AUTH_SESSION_KEY = 'strix-auth-session';
const LOCK_STORAGE_KEY = 'strix-is-locked';
const LOCAL_UI_PREFS_KEY = 'strix-device-ui-preferences';

export interface UIPreferences {
  scale: '95%' | '100%' | '105%' | '110%' | '115%' | '125%';
  font: 'default' | 'hyperlegible' | 'dyslexic';
  overlayColor: string;
  overlayOpacity: number;
  focusMode: boolean;
}

export const DEFAULT_UI_PREFERENCES: UIPreferences = {
  scale: '100%',
  font: 'default',
  overlayColor: 'transparent',
  overlayOpacity: 20,
  focusMode: false,
};

function readLocalUIPreferences(userId?: string | null): UIPreferences {
  try {
    const key = userId ? `${LOCAL_UI_PREFS_KEY}:${userId}` : LOCAL_UI_PREFS_KEY;
    const raw = localStorage.getItem(key) || localStorage.getItem(LOCAL_UI_PREFS_KEY);
    if (!raw) return DEFAULT_UI_PREFERENCES;
    return { ...DEFAULT_UI_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_UI_PREFERENCES;
  }
}

function writeLocalUIPreferences(prefs: UIPreferences, userId?: string | null): void {
  try {
    const serialized = JSON.stringify(prefs);
    localStorage.setItem(LOCAL_UI_PREFS_KEY, serialized);
    if (userId) {
      localStorage.setItem(`${LOCAL_UI_PREFS_KEY}:${userId}`, serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export interface UserProfile {
  id: string;
  email?: string | null;
  name: string | null;
  initials: string | null;
  pin: string | null;
  role: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  emergency_contact_phone?: string | null;
  is_active?: boolean;
  biometric_credential_id?: string | null;
  ui_preferences?: UIPreferences | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  uiPreferences: UIPreferences;
  isLoading: boolean;
  isLocked: boolean;
  hasPermission: (permission: string | string[], showToastOnDenied?: boolean) => boolean;
  checkAccess: (allowedRoles: string[]) => boolean;
  updateUIPreferences: (partial: Partial<UIPreferences>) => Promise<void>;
  resetUIPreferences: () => Promise<void>;
  lockSession: () => void;
  unlockWithPin: (pinCode: string) => boolean;
  unlockWithBiometrics: () => Promise<boolean>;
  registerBiometrics: () => Promise<boolean>;
  logout: (isExpired?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeRole(role?: string | null): string {
  if (!role) return 'ANONYMOUS';
  return role.trim().toUpperCase().replace(/\s+/g, '_');
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBuffer(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const getPermissionsQueryOptions = (role?: string | null, userId?: string | null) => {
  const normalizedRole = normalizeRole(role);

  return queryOptions({
    queryKey: ['rbac_permissions', normalizedRole, userId || 'none'],
    queryFn: async () => {
      if (!role) return [];
      if (normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR') {
        return ['*'];
      }

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

      const effectiveSet = new Set<string>((roleRes.data || []).map((r) => r.permission_key));

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

export const getUserProfileQueryOptions = (userId?: string | null) =>
  queryOptions({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, email, name, initials, pin, role, avatar_url, phone, is_active, biometric_credential_id, ui_preferences'
        )
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const cached = await get('strix-user-profile');
        return (cached || null) as UserProfile | null;
      }

      if (data) {
        await set('strix-user-profile', data);
      }
      return data as UserProfile | null;
    },
    enabled: Boolean(userId),
    networkMode: 'offlineFirst',
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24 * 14,
    meta: { persist: true },
  });

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    return localStorage.getItem(LOCK_STORAGE_KEY) === 'true';
  });
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);
  const [uiPreferences, setUiPreferences] = useState<UIPreferences>(() =>
    readLocalUIPreferences()
  );

  const logout = useCallback(
    async (isExpired = false) => {
      await supabase.auth.signOut().catch(() => {});
      await del(AUTH_SESSION_KEY);
      await del('strix-user-profile');
      localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
      localStorage.removeItem(LOCK_STORAGE_KEY);

      queryClient.clear();
      setSession(null);
      setUser(null);
      setIsLocked(false);
      setFailedPinAttempts(0);

      if (isExpired) {
        toast.error(
          'Security session expired (72h offline limit reached). Logged out for data protection.'
        );
      }
    },
    [queryClient]
  );

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

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: nativeSession },
        } = await supabase.auth.getSession();
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
            setUiPreferences(readLocalUIPreferences(activeSession.user.id));
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        setUiPreferences(readLocalUIPreferences(newSession.user.id));
        await set(AUTH_SESSION_KEY, newSession);
        localStorage.setItem(HEARTBEAT_STORAGE_KEY, Date.now().toString());
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setIsLocked(false);
        setFailedPinAttempts(0);
        await del(AUTH_SESSION_KEY);
        await del('strix-user-profile');
        localStorage.removeItem(HEARTBEAT_STORAGE_KEY);
        localStorage.removeItem(LOCK_STORAGE_KEY);
        queryClient.clear();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient, evaluateSecurityHeartbeat]);

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

  const { data: profile, status: profileStatus } = useQuery(getUserProfileQueryOptions(user?.id));
  const { data: rawPermissions = [] } = useQuery(
    getPermissionsQueryOptions(profile?.role, user?.id)
  );

  // SECURITY GATE: Immediately eject deactivated / suspended staff accounts
  useEffect(() => {
    if (profile && profile.is_active === false) {
      toast.error('Your staff account has been deactivated. Contact an administrator.');
      logout(false);
    }
  }, [profile, logout]);

  // Sync user's personal Accessibility Preferences from Supabase + Local Device Storage
  useEffect(() => {
    if (profile?.ui_preferences) {
      const merged: UIPreferences = {
        ...DEFAULT_UI_PREFERENCES,
        ...profile.ui_preferences,
      };
      setUiPreferences(merged);
      writeLocalUIPreferences(merged, user?.id);
    }
  }, [profile?.ui_preferences, user?.id]);

  // Apply active UI Preferences to HTML Root Variables in 0ms
  useEffect(() => {
    const html = document.documentElement;
    html.style.setProperty('--app-scale', uiPreferences.scale || '100%');

    if (!uiPreferences.font || uiPreferences.font === 'default') {
      html.removeAttribute('data-font');
    } else {
      html.setAttribute('data-font', uiPreferences.font);
    }

    if (uiPreferences.focusMode) {
      html.setAttribute('data-focus-mode', 'true');
    } else {
      html.removeAttribute('data-focus-mode');
    }
  }, [uiPreferences]);

  const updateUIPreferences = useCallback(
    async (partial: Partial<UIPreferences>) => {
      const updated: UIPreferences = { ...uiPreferences, ...partial };
      setUiPreferences(updated);
      writeLocalUIPreferences(updated, user?.id);

      if (user?.id) {
        const { error } = await supabase
          .from('users')
          .update({ ui_preferences: updated })
          .eq('id', user.id);

        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
        }
      }
    },
    [uiPreferences, user?.id, queryClient]
  );

  const resetUIPreferences = useCallback(async () => {
    setUiPreferences(DEFAULT_UI_PREFERENCES);
    writeLocalUIPreferences(DEFAULT_UI_PREFERENCES, user?.id);

    if (user?.id) {
      await supabase
        .from('users')
        .update({ ui_preferences: DEFAULT_UI_PREFERENCES })
        .eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
    }
    toast.success('Display and accessibility settings reset to default.');
  }, [user?.id, queryClient]);

  const lockSession = useCallback(() => {
    if (!profile?.pin && !profile?.biometric_credential_id) {
      toast.info('Set a 4-digit PIN or Biometrics in your profile to enable Quick Lock.');
      return;
    }
    setIsLocked(true);
    localStorage.setItem(LOCK_STORAGE_KEY, 'true');
  }, [profile?.pin, profile?.biometric_credential_id]);

  useEffect(() => {
    if (!user || isLocked || (!profile?.pin && !profile?.biometric_credential_id)) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        localStorage.setItem(LOCK_STORAGE_KEY, 'true');
      }, IDLE_SOFT_LOCK_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [user, isLocked, profile?.pin, profile?.biometric_credential_id]);

  // HARDENED PIN UNLOCK: Prevents null-PIN bypass & enforces 5-strike brute-force sign-out
  const unlockWithPin = useCallback(
    (pinCode: string): boolean => {
      if (!profile?.pin) {
        toast.error('No PIN configured for this account. Please unlock with Biometrics or Sign Out.');
        return false;
      }

      if (pinCode.trim().length > 0 && pinCode.trim() === profile.pin.trim()) {
        setIsLocked(false);
        setFailedPinAttempts(0);
        localStorage.removeItem(LOCK_STORAGE_KEY);
        toast.success(`Welcome back, ${profile?.name?.split(' ')[0] || 'Keeper'}`);
        return true;
      }

      const nextAttempts = failedPinAttempts + 1;
      setFailedPinAttempts(nextAttempts);

      if (nextAttempts >= MAX_PIN_ATTEMPTS) {
        toast.error('Too many failed PIN attempts. Session terminated for security.');
        logout(false);
        return false;
      }

      toast.error(
        `Incorrect PIN (${MAX_PIN_ATTEMPTS - nextAttempts} attempt${
          MAX_PIN_ATTEMPTS - nextAttempts === 1 ? '' : 's'
        } remaining)`
      );
      return false;
    },
    [profile?.pin, profile?.name, failedPinAttempts, logout]
  );

  const registerBiometrics = useCallback(async (): Promise<boolean> => {
    if (!user || !window.PublicKeyCredential) {
      toast.error('Biometric authentication is not supported on this browser/device.');
      return false;
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userIdBytes = new TextEncoder().encode(user.id);

      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'StrixOS Zoological ERP' },
          user: {
            id: userIdBytes,
            name: user.email || user.id,
            displayName: profile?.name || user.email || 'StrixOS Keeper',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },
            { alg: -257, type: 'public-key' },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) return false;

      const credId = bufferToBase64Url(credential.rawId);
      const { error } = await supabase
        .from('users')
        .update({ biometric_credential_id: credId })
        .eq('id', user.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ['userProfile', user.id] });
      toast.success('Device biometrics (FaceID / TouchID / Fingerprint) linked!');
      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Biometric enrollment cancelled.';
      toast.error(message);
      return false;
    }
  }, [user, profile?.name, queryClient]);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!profile?.biometric_credential_id || !window.PublicKeyCredential) {
      toast.error('No biometric credential registered for this device.');
      return false;
    }

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const allowId = base64UrlToBuffer(profile.biometric_credential_id);

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: allowId,
              type: 'public-key',
              transports: ['internal'],
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      });

      if (assertion) {
        setIsLocked(false);
        setFailedPinAttempts(0);
        localStorage.removeItem(LOCK_STORAGE_KEY);
        toast.success('Biometric unlock verified.');
        return true;
      }
      return false;
    } catch {
      toast.error('Biometric verification failed or cancelled. Please use your PIN.');
      return false;
    }
  }, [profile?.biometric_credential_id]);

  const activePermissionsSet = useMemo(() => {
    const set = new Set<string>();
    rawPermissions.forEach((p: string) => {
      if (!p) return;
      const trimmed = p.trim();
      set.add(trimmed);
      set.add(trimmed.toLowerCase());
    });
    return set;
  }, [rawPermissions]);

  // HARDENED RBAC CHECK: Strictly trusts RLS-backed profile.role (never client-writable user_metadata)
  const hasPermission = useCallback(
    (permission: string | string[], showToastOnDenied = false): boolean => {
      if (isLocked) return false;
      if (profileStatus === 'pending') return false;
      if (!profile || profile.is_active === false) return false;

      const normalizedRole = normalizeRole(profile.role);
      const isRootRole = normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR';

      if (isRootRole || activePermissionsSet.has('*')) return true;

      const checkSingle = (perm: string): boolean => {
        if (!perm) return false;
        const trimmed = perm.trim();
        const lower = trimmed.toLowerCase();
        return activePermissionsSet.has(trimmed) || activePermissionsSet.has(lower);
      };

      const allowed = Array.isArray(permission)
        ? permission.some(checkSingle)
        : checkSingle(permission);

      if (!allowed && showToastOnDenied) {
        toast.error('Unauthorized Access');
      }

      return allowed;
    },
    [isLocked, profile, profileStatus, activePermissionsSet]
  );

  const checkAccess = useCallback(
    (allowedRoles: string[]): boolean => {
      if (isLocked || !profile || profile.is_active === false) return false;
      const normalizedRole = normalizeRole(profile.role);
      if (normalizedRole === 'ADMIN' || normalizedRole === 'DIRECTOR') return true;
      return allowedRoles.map((r) => normalizeRole(r)).includes(normalizedRole);
    },
    [isLocked, profile]
  );

  const isFullyLoading = isSessionLoading || (Boolean(user) && profileStatus === 'pending');

  const contextValue = useMemo(
    () => ({
      session,
      user,
      profile: profile || null,
      uiPreferences,
      isLoading: isFullyLoading,
      isLocked,
      hasPermission,
      checkAccess,
      updateUIPreferences,
      resetUIPreferences,
      lockSession,
      unlockWithPin,
      unlockWithBiometrics,
      registerBiometrics,
      logout: () => logout(false),
      signOut: () => logout(false),
    }),
    [
      session,
      user,
      profile,
      uiPreferences,
      isFullyLoading,
      isLocked,
      hasPermission,
      checkAccess,
      updateUIPreferences,
      resetUIPreferences,
      lockSession,
      unlockWithPin,
      unlockWithBiometrics,
      registerBiometrics,
      logout,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;