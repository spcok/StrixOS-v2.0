import React, { useState, useEffect } from 'react';
import {
  createRootRouteWithContext,
  Outlet,
  useLocation,
  useNavigate,
  Navigate,
} from '@tanstack/react-router';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { Lock, Fingerprint, LogOut, KeyRound } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { AuthProvider, useAuth } from '../lib/auth';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { LoginScreen } from '../components/auth/LoginScreen';
import { supabase } from '../lib/supabase';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGuard />
      <Toaster position="top-center" richColors theme="light" />
    </AuthProvider>
  );
}

function GlobalSyncEngine() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel('strix-global-multiplexer')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table;

        const tableToKeyMap: Record<string, string[]> = {
          rbac_role_permissions: ['rbac_permissions', 'rbac_role_permissions_all'],
          user_permission_overrides: ['rbac_permissions', 'rbac_user_overrides'],
          users: ['internal_users', 'userProfile', 'rbac_permissions'],
          animals: ['animals'],
          external_directory: ['external_directory'],
          safety_drills: ['safety_drills'],
          shifts: ['shifts_data'],
          timesheets: ['timesheets', 'my_active_shift', 'active_timesheets_rollcall'],
          isolation_logs: ['isolation_logs_complete'],
          vouchers: ['vouchers', 'vouchers_list', 'all_vouchers_directory'],
          events_calendar: ['events_ledger_management', 'operational_calendar'],
          event_commercials: ['events_ledger_management'],
          event_staff_allocations: ['events_ledger_management'],
          events_animals: ['events_ledger_management'],
          feed_logs: ['feeds', 'feed_logs', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          weight_logs: ['weights', 'weight_logs', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          feeding_schedules: ['feeds', 'feeding_schedules', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          temperature_logs: ['temperatures', 'temperature_logs', 'weekly_compliance_audit'],
          mist_logs: ['mist_logs', 'weekly_compliance_audit'],
        };

        const keysToInvalidate = tableToKeyMap[table];
        if (keysToInvalidate) {
          keysToInvalidate.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, session]);

  return null;
}

function SoftLockOverlay() {
  const {
    isLocked,
    profile,
    unlockWithPin,
    unlockWithBiometrics,
    logout,
  } = useAuth();
  const [pinInput, setPinInput] = useState('');

  if (!isLocked) return null;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockWithPin(pinInput)) {
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[9000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
          <Lock size={24} />
        </div>

        <div>
          <h2 className="text-lg font-bold text-white">Session Locked</h2>
          <p className="text-xs text-slate-400 mt-1">
            Locked for shared tablet protection. Unlock as{' '}
            <strong className="text-white">{profile?.name || 'Staff'}</strong>
          </p>
        </div>

        {profile?.biometric_credential_id && (
          <button
            type="button"
            onClick={unlockWithBiometrics}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <Fingerprint size={18} />
            <span>Unlock with Biometrics (FaceID / TouchID)</span>
          </button>
        )}

        <form onSubmit={handlePinSubmit} className="space-y-3">
          <div className="relative">
            <KeyRound
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 4-Digit PIN"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-base font-bold tracking-widest text-white placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Unlock with PIN
          </button>
        </form>

        <button
          type="button"
          onClick={() => logout(false)}
          className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Switch User / Full Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function RouteGatekeeper({ children }: { children: React.ReactNode }) {
  const { hasPermission, profile, isLocked, isLoading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const routePermissions: Record<string, string | string[]> = {
    '/husbandry/daily-logs': ['husbandry:logs_view', 'husbandry:read'],
    '/husbandry/rounds': ['husbandry:rounds_view', 'husbandry:read'],
    '/husbandry/feeding': ['husbandry:feeding_view', 'husbandry:read'],
    '/husbandry/missing-records': ['husbandry:compliance_view', 'husbandry:read'],
    '/husbandry/import': ['husbandry:import', 'husbandry:write'],
    '/clinical/records': ['clinical:records_view', 'clinical:read'],
    '/clinical/medications': ['clinical:mar_view', 'clinical:read'],
    '/clinical/isolation': ['clinical:isolation_view', 'clinical:read'],
    '/clinical/mortality': ['clinical:mortality_view', 'clinical:read'],
    '/clinical': ['clinical:records_view', 'clinical:mar_view', 'clinical:read'],
    '/logistics/calendar': [
      'calendar:view_schedule',
      'calendar:view_assigned',
      'events:manage',
      'events:view',
    ],
    '/logistics/events': ['events:manage', 'events:view'],
    '/logistics/vouchers': [
      'vouchers:view',
      'vouchers:scan',
      'vouchers:manage',
      'vouchers:read',
    ],
    '/logistics/internal-movements': [
      'transfers:internal',
      'transfers:read',
      'animals:view',
    ],
    '/logistics/external-transfers': [
      'transfers:external',
      'transfers:read',
      'animals:manage',
    ],
    '/safety/drills': ['safety:drills_view', 'safety:read'],
    '/safety/incidents': ['safety:incidents_view', 'safety:read'],
    '/safety/first-aid': ['safety:firstaid_view', 'safety:read'],
    '/safety/maintenance': ['safety:maintenance_view', 'safety:read'],
    '/safety': ['safety:drills_view', 'safety:incidents_view', 'safety:read'],
    '/staff/rota': ['rota:view', 'rota:manage', 'hr:read'],
    '/staff/shifts': ['shifts:view_self', 'timesheet:self', 'rota:manage'],
    '/staff/leave': ['leave:view', 'leave:approve', 'hr:read'],
    '/staff/timesheets': ['timesheet:self', 'timesheet:manage', 'hr:read'],
    '/settings/rbac': ['rbac:manage', 'admin:settings'],
    '/settings/directory': ['admin:users', 'admin:settings'],
    '/settings': ['admin:settings', 'rbac:manage'],
    '/reports': ['reports:view', 'admin:settings'],
  };

  const matchedPerms = Object.entries(routePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([routePrefix]) => path.startsWith(routePrefix))?.[1];

  const hasAccess = matchedPerms ? hasPermission(matchedPerms) : true;
  const isDenied = !isLoading && profile && !isLocked && !hasAccess;

  useEffect(() => {
    if (isDenied) {
      toast.error(
        'Unauthorized Access: You do not have permission to view this module.'
      );
    }
  }, [isDenied]);

  if (isDenied) {
    return <Navigate to="/" replace={true} />;
  }

  return <>{children}</>;
}

function AuthGuard() {
  const { session, isLoading, uiPreferences } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const isRecoveryHash =
    typeof window !== 'undefined' &&
    (window.location.hash.includes('type=recovery') ||
      window.location.search.includes('type=recovery'));
  const isResetPasswordRoute =
    location.pathname.startsWith('/reset-password') || isRecoveryHash;

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate({ to: '/reset-password' });
      }
    });

    if (isRecoveryHash && location.pathname !== '/reset-password') {
      navigate({ to: '/reset-password' });
    }

    return () => subscription.unsubscribe();
  }, [navigate, isRecoveryHash, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
        <div className="animate-pulse text-emerald-500 font-bold tracking-wider text-sm">
          Initializing StrixOS 2.0...
        </div>
      </div>
    );
  }

  if (isResetPasswordRoute) {
    return (
      <main className="min-h-dvh w-full bg-slate-950">
        <Outlet />
      </main>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="flex h-dvh bg-slate-50 text-slate-900 font-sans antialiased relative overflow-hidden">
      {/* Global Irlen Coloured Overlay Filter */}
      {uiPreferences.overlayColor &&
        uiPreferences.overlayColor !== 'transparent' && (
          <div
            className="pointer-events-none fixed inset-0 z-[9999] mix-blend-multiply transition-colors duration-200"
            style={{
              backgroundColor: uiPreferences.overlayColor,
              opacity: (uiPreferences.overlayOpacity || 20) / 100,
            }}
          />
        )}

      <SoftLockOverlay />
      <GlobalSyncEngine />

      <Sidebar
        isOpen={isSidebarOpen}
        onMobileClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-300">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 relative custom-scrollbar">
          <RouteGatekeeper>
            <Outlet />
          </RouteGatekeeper>
        </main>
      </div>
    </div>
  );
}

export default Route;